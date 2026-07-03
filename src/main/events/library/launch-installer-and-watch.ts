import { shell } from "electron";
import { spawn } from "node:child_process";
import { registerEvent } from "../register-event";
import { gamesSublevel, levelKeys } from "@main/level";
import { logger, WindowManager, Wine } from "@main/services";
import type { GameShop } from "@types";

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

      child.once("close", onClose);
      child.once("error", (err2) => {
        logger.error("[launchInstallerAndWatch] wine failed", err2);
        shell.openPath(exePath).then(onClose);
      });
      return;
    }
  }

  if (process.platform === "win32") {
    const child = spawn(exePath, [], { stdio: "ignore", detached: false });
    child.once("close", onClose);
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
