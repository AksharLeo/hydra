import { registerEvent } from "../register-event";
import {
  DownloadManager,
  HydraApi,
  SSEClient,
  WindowManager,
  emulators,
  gamesPlaytime,
} from "@main/services";
import {
  db,
  downloadLayoutStateSublevel,
  downloadsSublevel,
  gamesSublevel,
  levelKeys,
} from "@main/level";

const signOut = async (_event: Electron.IpcMainInvokeEvent) => {
  const isSelfHostedActive = HydraApi.isSelfHostedAuthenticated();

  const databaseOperations = db
    .batch([
      {
        type: "del",
        key: levelKeys.auth,
      },
      {
        type: "del",
        key: levelKeys.user,
      },
    ])
    .then(async () => {
      gamesPlaytime.clear();

      if (isSelfHostedActive) return;

      await Promise.all([
        gamesSublevel.clear(),
        downloadsSublevel.clear(),
        downloadLayoutStateSublevel.clear(),
        emulators.resetEmulatorScanData(),
      ]);
    });

  DownloadManager.cancelDownload();

  HydraApi.handleSignOut();

  WindowManager.closeFriendsWindow();

  await Promise.all([
    databaseOperations,
    HydraApi.post("/auth/logout").catch(() => {}),
  ]);

  SSEClient.close();
};

registerEvent("signOut", signOut);
