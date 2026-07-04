import fs from "node:fs";
import { execFile } from "node:child_process";
import { registerEvent } from "../register-event";
import { logger } from "@main/services";

const SYSFS_GPU_PERF =
  "/sys/class/drm/card0/device/power_dpm_force_performance_level";
const SYSFS_CPU_GOVERNOR =
  "/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor";
const OS_RELEASE = "/etc/os-release";

function isCachyOSHandheld(): boolean {
  try {
    const content = fs.readFileSync(OS_RELEASE, "utf8");
    return content.includes("ID=cachyos");
  } catch {
    return false;
  }
}

function sudo(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "sudo",
      ["-n", cmd, ...args],
      { stdio: "ignore" } as never,
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// TDP via ryzenadj (milliwatts)
const setTdp = async (
  _: Electron.IpcMainInvokeEvent,
  watts: number
): Promise<{ ok: boolean; error?: string }> => {
  if (!isCachyOSHandheld()) return { ok: false, error: "Not CachyOS Handheld" };

  const mw = String(Math.round(watts * 1000));
  logger.info("[Perf] setTdp", { watts });

  try {
    await sudo("ryzenadj", [
      `--stapm-limit=${mw}`,
      `--slow-limit=${mw}`,
      `--fast-limit=${mw}`,
    ]);
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("[Perf] setTdp failed", { error });
    return { ok: false, error };
  }
};

// CPU governor
const setCpuGovernor = async (
  _: Electron.IpcMainInvokeEvent,
  governor: string
): Promise<{ ok: boolean; error?: string }> => {
  if (!isCachyOSHandheld()) return { ok: false, error: "Not CachyOS Handheld" };

  const allowed = ["powersave", "performance", "schedutil", "ondemand"];
  if (!allowed.includes(governor))
    return { ok: false, error: `Unknown governor: ${governor}` };

  logger.info("[Perf] setCpuGovernor", { governor });

  try {
    await sudo("cpupower", ["frequency-set", "-g", governor]);
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("[Perf] setCpuGovernor failed", { error });
    return { ok: false, error };
  }
};

// GPU performance level via sysfs
const setGpuPerfLevel = async (
  _: Electron.IpcMainInvokeEvent,
  level: string
): Promise<{ ok: boolean; error?: string }> => {
  if (!isCachyOSHandheld()) return { ok: false, error: "Not CachyOS Handheld" };

  const allowed = ["auto", "low", "high", "manual"];
  if (!allowed.includes(level))
    return { ok: false, error: `Unknown level: ${level}` };

  logger.info("[Perf] setGpuPerfLevel", { level });

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = execFile("sudo", ["-n", "tee", SYSFS_GPU_PERF], (err) =>
        err ? reject(err) : resolve()
      );
      proc.stdin?.write(level);
      proc.stdin?.end();
    });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("[Perf] setGpuPerfLevel failed", { error });
    return { ok: false, error };
  }
};

const getPerformanceState = async (): Promise<{
  isSupported: boolean;
  governor: string | null;
  gpuPerfLevel: string | null;
}> => {
  if (!isCachyOSHandheld())
    return { isSupported: false, governor: null, gpuPerfLevel: null };

  const readSys = (p: string) => {
    try {
      return fs.readFileSync(p, "utf8").trim();
    } catch {
      return null;
    }
  };

  return {
    isSupported: true,
    governor: readSys(SYSFS_CPU_GOVERNOR),
    gpuPerfLevel: readSys(SYSFS_GPU_PERF),
  };
};

registerEvent("setTdp", setTdp);
registerEvent("setCpuGovernor", setCpuGovernor);
registerEvent("setGpuPerfLevel", setGpuPerfLevel);
registerEvent("getPerformanceState", getPerformanceState);
