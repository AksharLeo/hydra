import https from "node:https";
import { app } from "electron";
import { logger } from "./logger";
import { WindowManager } from "./window-manager";
import type { ForkUpdateInfo } from "@types";

const OWNER = "AksharLeo";
const REPO = "hydra";

export class ForkUpdater {
  static async checkForUpdate(): Promise<ForkUpdateInfo | null> {
    try {
      const url = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;
      const release = await fetchJson(url);
      
      if (!release || !release.tag_name) return null;

      const latestVersion = (release.tag_name as string).replace(/^v/, "");
      const currentVersion = app.getVersion();

      // Basic version compare (assumes semver or similar format)
      if (latestVersion === currentVersion) return null;

      // Ensure latest is actually newer, not just different (simple check)
      // A more robust check would use a semver library, but for simplicity:
      if (latestVersion < currentVersion) return null;

      return {
        version: latestVersion,
        releaseName: (release.name as string) || latestVersion,
        releaseNotes: (release.body as string) || "",
        publishedAt: (release.published_at as string) || "",
        url: (release.html_url as string) || `https://github.com/${OWNER}/${REPO}/releases/latest`,
      };
    } catch (err) {
      logger.error("[ForkUpdater] checkForUpdate failed", { err });
      return null;
    }
  }

  static async checkAndNotify(): Promise<void> {
    const info = await this.checkForUpdate();
    if (info) {
      logger.info("[ForkUpdater] update available", { version: info.version });
      WindowManager.mainWindow?.webContents.send("forkUpdaterEvent", {
        type: "fork-update-available",
        info,
      });
    }
  }
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
