import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { GamepadButtonType } from "../../types";
import { useGamepad } from "../../hooks";
import "./styles.scss";

interface PerfState {
  isSupported: boolean;
  governor: string | null;
  gpuPerfLevel: string | null;
}

const CPU_GOVERNORS = ["powersave", "schedutil", "ondemand", "performance"];
const GPU_LEVELS = ["auto", "low", "high"];
const TDP_MIN = 3;
const TDP_MAX = 25;
const TDP_STEP = 1;

export function QuickAccessMenu() {
  const [open, setOpen] = useState(false);
  const [perfState, setPerfState] = useState<PerfState>({
    isSupported: false,
    governor: null,
    gpuPerfLevel: null,
  });
  const [tdp, setTdp] = useState(15);
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation("big_picture");
  const { onButtonPressed } = useGamepad();

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onButtonPressed(GamepadButtonType.HOME, (ev) => {
      if (!ev.accepted) return;
      setOpen((prev) => !prev);
    });
    return unsub;
  }, [onButtonPressed]);

  useEffect(() => {
    if (!open) return;
    globalThis.window.electron.getPerformanceState().then((state) => {
      setPerfState(state);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  if (!open) return null;

  const withBusy = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      const state = await globalThis.window.electron.getPerformanceState();
      setPerfState(state);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="qam-backdrop">
      <button
        className="qam-backdrop__close"
        aria-label="Close Quick Access Menu"
        onClick={() => setOpen(false)}
      />
      <div
        className="qam-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quick Access Menu"
      >
        <div className="qam-header">
          <span className="qam-header__title">
            {t("quick_access_menu", { defaultValue: "Quick Access" })}
          </span>
          <button className="qam-header__close" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>

        {!perfState.isSupported ? (
          <div className="qam-unsupported">
            {t("qam_unsupported", {
              defaultValue: "Performance controls require CachyOS Handheld",
            })}
          </div>
        ) : (
          <div className="qam-body">
            {/* TDP */}
            <section className="qam-section">
              <div className="qam-section__label">
                {t("qam_tdp", { defaultValue: "TDP" })}
                <span className="qam-section__value">{tdp} W</span>
              </div>
              <div className="qam-slider-row">
                <span>{TDP_MIN}W</span>
                <input
                  type="range"
                  min={TDP_MIN}
                  max={TDP_MAX}
                  step={TDP_STEP}
                  value={tdp}
                  disabled={busy}
                  className="qam-slider"
                  onChange={(e) => setTdp(Number(e.target.value))}
                  onMouseUp={() =>
                    withBusy(() => globalThis.window.electron.setTdp(tdp))
                  }
                  onTouchEnd={() =>
                    withBusy(() => globalThis.window.electron.setTdp(tdp))
                  }
                />
                <span>{TDP_MAX}W</span>
              </div>
            </section>

            {/* CPU Governor */}
            <section className="qam-section">
              <div className="qam-section__label">
                {t("qam_cpu_governor", { defaultValue: "CPU Governor" })}
              </div>
              <div className="qam-chip-group">
                {CPU_GOVERNORS.map((g) => (
                  <button
                    key={g}
                    className={`qam-chip${perfState.governor === g ? " qam-chip--active" : ""}`}
                    disabled={busy}
                    onClick={() =>
                      withBusy(() =>
                        globalThis.window.electron.setCpuGovernor(g)
                      )
                    }
                  >
                    {g}
                  </button>
                ))}
              </div>
            </section>

            {/* GPU Performance Level */}
            <section className="qam-section">
              <div className="qam-section__label">
                {t("qam_gpu_level", { defaultValue: "GPU Performance" })}
              </div>
              <div className="qam-chip-group">
                {GPU_LEVELS.map((l) => (
                  <button
                    key={l}
                    className={`qam-chip${perfState.gpuPerfLevel === l ? " qam-chip--active" : ""}`}
                    disabled={busy}
                    onClick={() =>
                      withBusy(() =>
                        globalThis.window.electron.setGpuPerfLevel(l)
                      )
                    }
                  >
                    {l}
                  </button>
                ))}
              </div>
            </section>

            {busy && (
              <div className="qam-busy">
                {t("qam_applying", { defaultValue: "Applying…" })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
