import path from "node:path";
import fs from "node:fs";

import { registerEvent } from "../register-event";
import { logger } from "@main/services/logger";
import { downloadsSublevel, gamesSublevel, levelKeys } from "@main/level";

export const deleteArchiveFile = async (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      logger.info(`Deleted archive: ${filePath}`);
    }

    // Find the game that has this archive and clear installer size
    const normalizedPath = path.normalize(filePath);
    const downloads = await downloadsSublevel.values().all();

    for (const download of downloads) {
      if (!download.folderName) continue;

      const downloadPath = path.normalize(
        path.join(download.downloadPath, download.folderName)
      );

      if (downloadPath === normalizedPath) {
        const gameKey = levelKeys.game(download.shop, download.objectId);
        const game = await gamesSublevel.get(gameKey);

        if (game) {
          await gamesSublevel.put(gameKey, {
            ...game,
            installerSizeInBytes: null,
          });
        }
        break;
      }
    }

    return true;
  } catch (err) {
    logger.error(`Failed to delete archive: ${filePath}`, err);
    return false;
  }
};

const deleteArchive = async (
  _event: Electron.IpcMainInvokeEvent,
  filePath: string
) => deleteArchiveFile(filePath);

registerEvent("deleteArchive", deleteArchive);

const deleteInstallerFolder = async (
  _event: Electron.IpcMainInvokeEvent,
  folderPath: string
) => {
  try {
    if (fs.existsSync(folderPath)) {
      await fs.promises.rm(folderPath, { recursive: true, force: true });
      logger.info(`Deleted installer folder: ${folderPath}`);
    }
    return true;
  } catch (err) {
    logger.error(`Failed to delete installer folder: ${folderPath}`, err);
    return false;
  }
};

registerEvent("deleteInstallerFolder", deleteInstallerFolder);
