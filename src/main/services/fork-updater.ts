import https from "node:https";
import { logger } from "./logger";
import { WindowManager } from "./window-manager";
import type { ForkUpdateInfo } from "@types";

const OWNER = "entitybtw";
const REPO = "hydra";
const WORKFLOW_FILE = "build.yml";
const BRANCH = "main";

const CURRENT_RUN_ID: number = Number(
  import.meta.env.MAIN_VITE_GITHUB_RUN_ID ?? 0
);

export class ForkUpdater {
  static getCurrentRunId(): number {
    return CURRENT_RUN_ID;
  }

  static getRunUrl(runId: number): string {
    return `https://github.com/${OWNER}/${REPO}/actions/runs/${runId}`;
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
      WindowManager.mainWindow?.webContents.send("forkUpdaterEvent", {
        type: "fork-update-available",
        info,
      });
    }
  }
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
