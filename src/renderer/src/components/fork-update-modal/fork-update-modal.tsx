import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@renderer/components/modal/modal";
import type { ForkUpdateInfo } from "@types";

const DISMISSED_KEY = "fork-update-dismissed-version";

export function ForkUpdateModal() {
  const [info, setInfo] = useState<ForkUpdateInfo | null>(null);
  const { t } = useTranslation("header");

  useEffect(() => {
    const unsubscribe = window.electron.onForkUpdaterEvent((event) => {
      if (event.type !== "fork-update-available") return;
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed === event.info.version) return;
      setInfo(event.info);
    });
    return () => unsubscribe();
  }, []);

  const handleClose = () => {
    if (info) localStorage.setItem(DISMISSED_KEY, info.version);
    setInfo(null);
  };

  const handleOpenArtifacts = () => {
    const url = info!.url;
    window.electron.openExternal(url);
  };

  return (
    <Modal
      visible={info !== null}
      title={t("fork_update_title", { buildNumber: info?.version ?? "" })}
      onClose={handleClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {info?.releaseNotes && (
          <p
            style={{ margin: 0, color: "var(--body-color)", fontSize: "13px" }}
          >
            {info.releaseNotes}
          </p>
        )}
        <div
          style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}
        >
          <button
            type="button"
            className="button theme-button"
            onClick={handleOpenArtifacts}
          >
            {t("fork_update_open_artifacts")}
          </button>
          <button type="button" className="button" onClick={handleClose}>
            {t("fork_update_close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
