import { shell } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";
import { registerEvent } from "../register-event";
import { gamesSublevel, levelKeys } from "@main/level";
import { logger, NativeAddon, WindowManager, Wine } from "@main/services";
import type { GameShop } from "@types";

const POLL_INTERVAL = 5000;
const IDLE_THRESHOLD = 30_000;
const MAX_TIMEOUT = 2 * 60 * 60 * 1000;

const waitForInstallerExit = async (exePath: string): Promise<void> => {
  const installerName = path.basename(exePath).toLowerCase();
  const startTime = Date.now();
  let idleMs = 0;

  while (Date.now() - startTime < MAX_TIMEOUT) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    try {
      const processes = await NativeAddon.listProcesses();
      const hasRelevant = processes.some((p) => {
        const name = (p.name ?? "").toLowerCase();
        const exe = (p.exe ?? "").toLowerCase();
        return (
          name.includes("wine") ||
          name.includes("umu") ||
          exe.includes(installerName) ||
          name.includes("setup") ||
          name.includes("install")
        );
      });

      idleMs = hasRelevant ? 0 : idleMs + POLL_INTERVAL;
    } catch {
      idleMs += POLL_INTERVAL;
    }

    if (idleMs >= IDLE_THRESHOLD) return;
  }
};

const launchInstallerAndWatch = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string,
  exePath: string,
  folderPath: string
) => {
  const game = await gamesSublevel
    .get(levelKeys.game(shop, objectId))
    .catch(() => null);

  const onClose = () => {
    WindowManager.sendToAppWindows("on-installer-closed", {
      shop,
      objectId,
      folderPath,
    });
  };

  if (process.platform === "linux") {
    try {
      const { Umu } = await import("@main/services");
      const effectiveWinePrefixPath = Wine.getEffectivePrefixPath(
        game?.winePrefixPath,
        objectId
      );
      await Umu.launchExecutable(exePath, [], {
        gameId: objectId,
        winePrefixPath: effectiveWinePrefixPath,
        protonPath: game?.protonPath,
      });

      await waitForInstallerExit(exePath);
      onClose();
      return;
    } catch (err) {
      logger.warn(
        "[launchInstallerAndWatch] umu-run failed, falling back to wine",
        err
      );

      const child = spawn("wine", [exePath], {
        stdio: "ignore",
        detached: false,
      });

      child.once("close", () => {
        waitForInstallerExit(exePath).then(onClose);
      });
      child.once("error", (err2) => {
        logger.error("[launchInstallerAndWatch] wine failed", err2);
        shell.openPath(exePath).then(onClose);
      });
      return;
    }
  }

  if (process.platform === "win32") {
    const child = spawn(exePath, [], { stdio: "ignore", detached: false });
    child.once("close", () => {
      waitForInstallerExit(exePath).then(onClose);
    });
    child.once("error", (err) => {
      logger.error("[launchInstallerAndWatch] direct launch failed", err);
      shell.openPath(exePath).then(onClose);
    });
    return;
  }

  // macOS / other: can't track process exit
  await shell.openPath(exePath);
  onClose();
};

registerEvent("launchInstallerAndWatch", launchInstallerAndWatch);
