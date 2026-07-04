import { isGameInstalledOnSteam } from "@main/services";
import type { GameShop } from "@types";
import { registerEvent } from "../register-event";

const checkGameOnSteam = async (
  _event: Electron.IpcMainInvokeEvent,
  _shop: GameShop,
  objectId: string
) => {
  return isGameInstalledOnSteam(objectId).catch(() => false);
};

registerEvent("checkGameOnSteam", checkGameOnSteam);
