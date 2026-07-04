import fs from "node:fs";
import { execFile } from "node:child_process";
import { registerEvent } from "../register-event";
import { logger } from "@main/services";

const OS_RELEASE = "/etc/os-release";
const SDDM_CONF_DIR = "/etc/sddm.conf.d";
const SDDM_AUTOLOGIN_CONF = `${SDDM_CONF_DIR}/autologin.conf`;

const STEAM_SESSION = "gamescope-steamos";
const HYDRA_SESSION = "hydra-gamescope";

function isCachyOSHandheld(): boolean {
  try {
    const content = fs.readFileSync(OS_RELEASE, "utf8");
    return content.includes("ID=cachyos") && content.includes("handheld");
  } catch {
    return false;
  }
}

function parseSddmSession(content: string): string | null {
  const match = content.match(/^\s*Session\s*=\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

function buildSddmConf(user: string, session: string): string {
  return `[Autologin]\nUser=${user}\nSession=${session}\n`;
}

function getSddmUser(content: string): string {
  const match = content.match(/^\s*User\s*=\s*(.+)$/m);
  return match ? match[1].trim() : (process.env.USER ?? "user");
}

const getSddmSession = async (): Promise<{
  isSupported: boolean;
  session: string | null;
  isHydraSession: boolean;
}> => {
  if (!isCachyOSHandheld())
    return { isSupported: false, session: null, isHydraSession: false };

  try {
    const content = fs.readFileSync(SDDM_AUTOLOGIN_CONF, "utf8");
    const session = parseSddmSession(content);
    return {
      isSupported: true,
      session,
      isHydraSession: session !== null && session !== STEAM_SESSION,
    };
  } catch {
    return { isSupported: true, session: null, isHydraSession: false };
  }
};

const setSddmSession = async (
  _: Electron.IpcMainInvokeEvent,
  useHydra: boolean
): Promise<{ ok: boolean; error?: string }> => {
  if (!isCachyOSHandheld()) return { ok: false, error: "Not CachyOS Handheld" };

  const targetSession = useHydra ? HYDRA_SESSION : STEAM_SESSION;
  logger.info("[SDDM] setSddmSession", { targetSession });

  try {
    let existingContent = "";
    try {
      existingContent = fs.readFileSync(SDDM_AUTOLOGIN_CONF, "utf8");
    } catch (e) {
      logger.warn("[SDDM] could not read autologin.conf", { e });
    }

    const user = getSddmUser(existingContent) || (process.env.USER ?? "user");
    const newContent = buildSddmConf(user, targetSession);

    await new Promise<void>((resolve, reject) => {
      const proc = execFile(
        "sudo",
        ["-n", "tee", SDDM_AUTOLOGIN_CONF],
        (err) => (err ? reject(err) : resolve())
      );
      proc.stdin?.write(newContent);
      proc.stdin?.end();
    });

    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("[SDDM] setSddmSession failed", { error });
    return { ok: false, error };
  }
};

registerEvent("getSddmSession", getSddmSession);
registerEvent("setSddmSession", setSddmSession);
