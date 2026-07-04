import fs from "node:fs";
import https from "node:https";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { execFile, spawn } from "node:child_process";
import { app } from "electron";
import extractZip from "extract-zip";
import { logger } from "./logger";
import { WindowManager } from "./window-manager";
import type { ForkUpdaterEvent, ForkUpdateInfo } from "@types";

const OWNER = "entitybtw";
const REPO = "hydra";
const WORKFLOW_FILE = "build.yml";
const BRANCH = "main";

const ARTIFACT_NAME: Partial<Record<string, string>> = {
  linux: "Build-production-ubuntu-latest",
  win32: "Build-production-windows-2022",
};

const FILE_PATTERN: Partial<Record<string, RegExp>> = {
  linux: /\.AppImage$/,
  win32: /-setup\.exe$/i,
};

const CURRENT_RUN_ID: number = Number(
  import.meta.env.MAIN_VITE_GITHUB_RUN_ID ?? 0
);

export class ForkUpdater {
  private static sendEvent(event: ForkUpdaterEvent) {
    WindowManager.mainWindow?.webContents.send("forkUpdaterEvent", event);
  }

  static getCurrentRunId(): number {
    return CURRENT_RUN_ID;
  }

  static async checkForUpdate(): Promise<ForkUpdateInfo | null> {
    try {
      const url = `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?branch=${BRANCH}&status=success&event=push&per_page=1`;
      const data = await fetchJson(url);

      const run = data?.workflow_runs?.[0] as
        | Record<string, unknown>
        | undefined;
      if (!run) return null;

      const runId = run.id as number;
      if (CURRENT_RUN_ID > 0 && runId <= CURRENT_RUN_ID) return null;

      return buildInfo(run);
    } catch (err) {
      logger.error("[ForkUpdater] checkForUpdate failed", { err });
      return null;
    }
  }

  static async checkAndNotify(): Promise<void> {
    const info = await this.checkForUpdate();
    if (info) {
      logger.info("[ForkUpdater] update available", { runId: info.runId });
      this.sendEvent({ type: "fork-update-available", info });
    }
  }

  static getNightlyLinkUrl(): string | null {
    const artifactName = ARTIFACT_NAME[process.platform];
    if (!artifactName) return null;
    return `https://nightly.link/${OWNER}/${REPO}/workflows/${WORKFLOW_FILE}/${BRANCH}/${artifactName}.zip`;
  }

  static async downloadAndInstall(): Promise<void> {
    const downloadUrl = this.getNightlyLinkUrl();
    if (!downloadUrl) {
      this.sendEvent({
        type: "fork-update-error",
        error: "Platform not supported",
      });
      return;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hydra-update-"));
    const zipPath = path.join(tmpDir, "update.zip");

    try {
      logger.info("[ForkUpdater] downloading", { downloadUrl });
      await downloadFile(downloadUrl, zipPath, (percent) => {
        this.sendEvent({ type: "fork-update-progress", percent });
      });

      logger.info("[ForkUpdater] extracting to", { tmpDir });
      await extractZip(zipPath, { dir: tmpDir });

      const pattern = FILE_PATTERN[process.platform];
      if (!pattern) throw new Error("Unsupported platform");

      const installerPath = findFile(tmpDir, pattern);
      if (!installerPath)
        throw new Error("Installer not found in artifact ZIP");
      logger.info("[ForkUpdater] installer found", { installerPath });
      this.sendEvent({ type: "fork-update-downloaded", installerPath });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error("[ForkUpdater] download failed", { error });
      this.sendEvent({ type: "fork-update-error", error });
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {
        logger.warn("[ForkUpdater] cleanup failed", { e });
      }
    }
  }

  static install(installerPath: string): void {
    if (process.platform === "linux") {
      const currentExe = app.getPath("exe");
      try {
        fs.chmodSync(installerPath, 0o755);
        fs.copyFileSync(installerPath, currentExe);
        fs.chmodSync(currentExe, 0o755);
        app.relaunch();
        app.quit();
      } catch (err) {
        logger.error("[ForkUpdater] AppImage replace failed, trying pkexec", {
          err,
        });
        execFile("pkexec", ["cp", installerPath, currentExe], () => {
          app.relaunch();
          app.quit();
        });
      }
    } else if (process.platform === "win32") {
      const proc = spawn(installerPath, ["/S"], {
        detached: true,
        stdio: "ignore",
      });
      proc.unref();
      app.quit();
    }
  }
}

function findFile(dir: string, pattern: RegExp): string | null {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, pattern);
      if (found) return found;
    } else if (pattern.test(entry.name)) {
      return full;
    }
  }
  return null;
}

function buildInfo(run: Record<string, unknown>): ForkUpdateInfo {
  const commit = run.head_commit as Record<string, string> | undefined;
  return {
    runId: run.id as number,
    runNumber: run.run_number as number,
    commitMessage: commit?.message ?? "",
    commitSha: run.head_sha as string,
    publishedAt: run.created_at as string,
  };
}

function fetchJson(url: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "hydra-launcher",
            Accept: "application/vnd.github+json",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        }
      )
      .on("error", reject);
  });
}

function downloadFile(
  url: string,
  dest: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (currentUrl: string) => {
      const mod = currentUrl.startsWith("https") ? https : http;
      mod
        .get(
          currentUrl,
          { headers: { "User-Agent": "hydra-launcher" } },
          (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
              follow(res.headers.location!);
              return;
            }
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}`));
              return;
            }
            const total = parseInt(res.headers["content-length"] ?? "0", 10);
            let received = 0;
            const file = fs.createWriteStream(dest);
            res.on("data", (chunk: Buffer) => {
              received += chunk.length;
              if (total > 0) onProgress(Math.round((received / total) * 100));
            });
            res.pipe(file);
            file.on("finish", () => file.close(() => resolve()));
            file.on("error", reject);
          }
        )
        .on("error", reject);
    };
    follow(url);
  });
}
