import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, HorizontalFocusGroup, Modal } from "../common";
import type { ForkUpdateInfo } from "@types";

import "./styles.scss";

const DISMISSED_KEY = "fork-update-dismissed-version";

const CONFIRM_REGION = "fork-update-modal-actions";
const OPEN_BUTTON_ID = "fork-update-open-btn";
const CLOSE_BUTTON_ID = "fork-update-close-btn";

export function ForkUpdateModal() {
  const [info, setInfo] = useState<ForkUpdateInfo | null>(null);
  const { t } = useTranslation("big_picture");

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
    handleClose();
  };

  return (
    <Modal
      visible={info !== null}
      title={t("fork_update_title", { buildNumber: info?.version ?? "" })}
      onClose={handleClose}
    >
      <div className="fork-update-modal__body">
        {info?.releaseNotes && (
          <p className="fork-update-modal__commit">{info.releaseNotes}</p>
        )}
      </div>

      <HorizontalFocusGroup regionId={CONFIRM_REGION} asChild>
        <div className="fork-update-modal__actions">
          <Button
            focusId={OPEN_BUTTON_ID}
            onClick={handleOpenArtifacts}
            focusNavigationOverrides={{
              right: { type: "item", itemId: CLOSE_BUTTON_ID },
            }}
          >
            {t("fork_update_open_artifacts")}
          </Button>
          <Button
            focusId={CLOSE_BUTTON_ID}
            onClick={handleClose}
            focusNavigationOverrides={{
              left: { type: "item", itemId: OPEN_BUTTON_ID },
            }}
          >
            {t("fork_update_close")}
          </Button>
        </div>
      </HorizontalFocusGroup>
    </Modal>
  );
}
