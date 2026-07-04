import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { app } from "electron";
import { registerEvent } from "../register-event";
import { logger } from "@main/services";

const OS_RELEASE = "/etc/os-release";
const SDDM_AUTOLOGIN_CONF = "/etc/sddm.conf.d/autologin.conf";
const HYDRA_SESSION_SCRIPT = "/usr/local/bin/hydra-gamescope-session";
const HYDRA_DESKTOP_FILE =
  "/usr/share/wayland-sessions/hydra-gamescope.desktop";
const HYDRA_SUDOERS = "/etc/sudoers.d/hydra";

const STEAM_SESSION = "gamescope-steamos";
const HYDRA_SESSION = "hydra-gamescope";

function isCachyOSHandheld(): boolean {
  try {
    const content = fs.readFileSync(OS_RELEASE, "utf8");
    return content.includes("ID=cachyos");
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

function isSetupDone(): boolean {
  return (
    fs.existsSync(HYDRA_SESSION_SCRIPT) &&
    fs.existsSync(HYDRA_DESKTOP_FILE) &&
    fs.existsSync(HYDRA_SUDOERS)
  );
}

function buildSetupScript(hydraExecPath: string, username: string): string {
  return `#!/bin/bash
set -e

HYDRA_EXEC='${hydraExecPath.replace(/'/g, "'\\''")}'
USERNAME='${username.replace(/'/g, "'\\''")}'

# Session wrapper
mkdir -p /usr/local/bin
printf '#!/bin/bash\\nexec gamescope --fullscreen --xwayland-count 2 --adaptive-sync -- "%s" --big-picture\\n' "$HYDRA_EXEC" > /usr/local/bin/hydra-gamescope-session
chmod +x /usr/local/bin/hydra-gamescope-session

# Wayland session .desktop
mkdir -p /usr/share/wayland-sessions
cat > /usr/share/wayland-sessions/hydra-gamescope.desktop << 'DEOF'
[Desktop Entry]
Name=Hydra Big Picture
Comment=Hydra Launcher in Big Picture mode
Exec=/usr/local/bin/hydra-gamescope-session
Type=Application
DesktopNames=HydraGamescope
DEOF

# Sudoers
mkdir -p /etc/sudoers.d
printf '%s ALL=(root) NOPASSWD: /usr/bin/tee /etc/sddm.conf.d/autologin.conf\\n' "$USERNAME" > /etc/sudoers.d/hydra
printf '%s ALL=(root) NOPASSWD: /usr/bin/ryzenadj\\n' "$USERNAME" >> /etc/sudoers.d/hydra
printf '%s ALL=(root) NOPASSWD: /usr/bin/cpupower\\n' "$USERNAME" >> /etc/sudoers.d/hydra
printf '%s ALL=(root) NOPASSWD: /usr/bin/tee /sys/class/drm/card0/device/power_dpm_force_performance_level\\n' "$USERNAME" >> /etc/sudoers.d/hydra
chmod 440 /etc/sudoers.d/hydra

# Ensure sddm conf dir
mkdir -p /etc/sddm.conf.d
`;
}

async function runPkexec(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("pkexec", [cmd, ...args], (err) =>
      err ? reject(err) : resolve()
    );
  });
}

async function sudoTeePipe(destPath: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = execFile("sudo", ["-n", "tee", destPath], (err) =>
      err ? reject(err) : resolve()
    );
    proc.stdin?.write(content);
    proc.stdin?.end();
  });
}

async function runHandheldSetup(): Promise<void> {
  const hydraExecPath = app.getPath("exe");
  const username = process.env.USER ?? os.userInfo().username;

  const scriptContent = buildSetupScript(hydraExecPath, username);
  const tmpScript = path.join(os.tmpdir(), `hydra-setup-${Date.now()}.sh`);

  try {
    fs.writeFileSync(tmpScript, scriptContent, { mode: 0o700 });
    await runPkexec("/bin/bash", [tmpScript]);
  } finally {
    try {
      fs.unlinkSync(tmpScript);
    } catch (e) {
      logger.warn("[SDDM] could not delete temp script", { e });
    }
  }
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
    if (useHydra && !isSetupDone()) {
      logger.info("[SDDM] running first-time setup via pkexec");
      await runHandheldSetup();
    }

    let existingContent = "";
    try {
      existingContent = fs.readFileSync(SDDM_AUTOLOGIN_CONF, "utf8");
    } catch (e) {
      logger.warn("[SDDM] could not read autologin.conf", { e });
    }

    const user = getSddmUser(existingContent) || (process.env.USER ?? "user");
    const newContent = buildSddmConf(user, targetSession);

    await sudoTeePipe(SDDM_AUTOLOGIN_CONF, newContent);

    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("[SDDM] setSddmSession failed", { error });
    return { ok: false, error };
  }
};

registerEvent("getSddmSession", getSddmSession);
registerEvent("setSddmSession", setSddmSession);
