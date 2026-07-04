import { registerEvent } from "../register-event";
import { ForkUpdater } from "@main/services/fork-updater";

registerEvent("checkForkUpdate", async () => {
  return ForkUpdater.checkForUpdate();
});

registerEvent("downloadForkUpdate", async () => {
  ForkUpdater.downloadAndInstall();
});

registerEvent("installForkUpdate", async (_event, installerPath: string) => {
  ForkUpdater.install(installerPath);
});
