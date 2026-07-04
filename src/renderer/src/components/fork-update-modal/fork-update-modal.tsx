import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@renderer/components/modal/modal";
import type { ForkUpdateInfo } from "@types";

const DISMISSED_KEY = "fork-update-dismissed-run";

export function ForkUpdateModal() {
  const [info, setInfo] = useState<ForkUpdateInfo | null>(null);
  const { t } = useTranslation("header");

  useEffect(() => {
    const unsubscribe = window.electron.onForkUpdaterEvent((event) => {
      if (event.type !== "fork-update-available") return;
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed === String(event.info.runId)) return;
      setInfo(event.info);
    });
    return () => unsubscribe();
  }, []);

  const handleClose = () => {
    if (info) localStorage.setItem(DISMISSED_KEY, String(info.runId));
    setInfo(null);
  };

  const handleOpenArtifacts = () => {
    const url = `https://github.com/entitybtw/hydra/actions/runs/${info!.runId}`;
    window.electron.openExternal(url);
  };

  const platform = window.electron.platform;
  const instructionsKey =
    platform === "win32"
      ? "fork_update_instructions_windows"
      : "fork_update_instructions_linux";

  return (
    <Modal
      visible={info !== null}
      title={t("fork_update_title", { buildNumber: info?.runNumber ?? "" })}
      onClose={handleClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {info?.commitMessage && (
          <p style={{ margin: 0, color: "var(--body-color)", fontSize: "13px" }}>
            {info.commitMessage}
          </p>
        )}
        <p style={{ margin: 0, fontSize: "13px" }}>{t(instructionsKey)}</p>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="button theme-button"
            onClick={handleOpenArtifacts}
          >
            {t("fork_update_open_artifacts")}
          </button>
          <button
            type="button"
            className="button"
            onClick={handleClose}
          >
            {t("fork_update_close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
