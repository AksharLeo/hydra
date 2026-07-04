import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ForkUpdateInfo, ForkUpdaterEvent } from "@types";
import "./styles.scss";

const DISMISSED_KEY = "fork-update-dismissed-run";

type DownloadState = "idle" | "downloading" | "downloaded";

export function ForkUpdateBanner() {
  const { t } = useTranslation("big_picture");

  const [updateInfo, setUpdateInfo] = useState<ForkUpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");
  const [progress, setProgress] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const installerRef = useRef<string | null>(null);

  useEffect(() => {
    window.electron.checkForkUpdate().then((info) => {
      if (!info) return;
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed === String(info.runId)) return;
      setUpdateInfo(info);
    });

    const unsubscribe = window.electron.onForkUpdaterEvent(
      (event: ForkUpdaterEvent) => {
        if (event.type === "fork-update-progress") {
          setProgress(event.percent);
        } else if (event.type === "fork-update-downloaded") {
          installerRef.current = event.installerPath;
          setDownloadState("downloaded");
        } else if (event.type === "fork-update-error") {
          setDownloadState("idle");
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  if (!updateInfo || dismissed) return null;

  const commitSnippet = updateInfo.commitMessage.split("\n")[0].slice(0, 80);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(updateInfo.runId));
    setDismissed(true);
  };

  const handleDownload = () => {
    setDownloadState("downloading");
    setProgress(0);
    window.electron.downloadForkUpdate();
  };

  const handleInstallClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmInstall = () => {
    if (installerRef.current) {
      window.electron.installForkUpdate(installerRef.current);
    }
  };

  if (showConfirm) {
    return (
      <div className="fork-update-banner fork-update-banner--confirm">
        <div className="fork-update-banner__content">
          <span className="fork-update-banner__label">
            {t("fork_update_confirm_title")}
          </span>
          <span className="fork-update-banner__commit">
            {t("fork_update_confirm_description", {
              buildNumber: updateInfo.runNumber,
              commitMessage: commitSnippet,
            })}
          </span>
        </div>
        <div className="fork-update-banner__actions">
          <button
            type="button"
            className="fork-update-banner__btn fork-update-banner__btn--ok"
            onClick={handleConfirmInstall}
          >
            {t("fork_update_confirm_ok")}
          </button>
          <button
            type="button"
            className="fork-update-banner__btn fork-update-banner__btn--cancel"
            onClick={() => setShowConfirm(false)}
          >
            {t("fork_update_confirm_cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (downloadState === "downloading") {
    return (
      <div className="fork-update-banner">
        <div className="fork-update-banner__content">
          <span className="fork-update-banner__label">
            {t("fork_update_downloading", { percent: progress })}
          </span>
          <div className="fork-update-banner__progress">
            <div
              className="fork-update-banner__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (downloadState === "downloaded") {
    return (
      <div className="fork-update-banner">
        <div className="fork-update-banner__content">
          <span className="fork-update-banner__label">
            {t("fork_update_available", { buildNumber: updateInfo.runNumber })}
          </span>
          {commitSnippet && (
            <span className="fork-update-banner__commit">{commitSnippet}</span>
          )}
        </div>
        <div className="fork-update-banner__actions">
          <button
            type="button"
            className="fork-update-banner__btn fork-update-banner__btn--ok"
            onClick={handleInstallClick}
          >
            {t("fork_update_install")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fork-update-banner">
      <div className="fork-update-banner__content">
        <span className="fork-update-banner__label">
          {t("fork_update_available", { buildNumber: updateInfo.runNumber })}
        </span>
        {commitSnippet && (
          <span className="fork-update-banner__commit">{commitSnippet}</span>
        )}
      </div>
      <div className="fork-update-banner__actions">
        <button
          type="button"
          className="fork-update-banner__btn fork-update-banner__btn--ok"
          onClick={handleDownload}
        >
          {t("fork_update_download")}
        </button>
        <button
          type="button"
          className="fork-update-banner__btn fork-update-banner__btn--cancel"
          onClick={handleDismiss}
        >
          {t("fork_update_dismiss")}
        </button>
      </div>
    </div>
  );
}
