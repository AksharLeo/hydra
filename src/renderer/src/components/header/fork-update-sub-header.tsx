import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SyncIcon } from "@primer/octicons-react";
import type { ForkUpdateInfo, ForkUpdaterEvent } from "@types";
import "./auto-update-header.scss";
import "./fork-update-header.scss";

const DISMISSED_KEY = "fork-update-dismissed-run";

type DownloadState = "idle" | "downloading" | "downloaded";

export function ForkUpdateSubHeader() {
  const { t } = useTranslation("header");

  const [updateInfo, setUpdateInfo] = useState<ForkUpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");
  const [progress, setProgress] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);

  const installerRef = useRef<string | null>(null);

  useEffect(() => {
    window.electron.checkForkUpdate().then((info) => {
      if (!info) return;
      const saved = localStorage.getItem(DISMISSED_KEY);
      if (saved === String(info.runId)) return;
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
      <header className="auto-update-sub-header fork-update-confirm">
        <span className="fork-update-confirm__text">
          {t("fork_update_confirm_title")}{" "}
          <span className="fork-update-confirm__commit">
            {t("fork_update_confirm_description", {
              buildNumber: updateInfo.runNumber,
              commitMessage: commitSnippet,
            })}
          </span>
        </span>
        <button
          type="button"
          className="auto-update-sub-header__new-version-button fork-update-confirm__ok"
          onClick={handleConfirmInstall}
        >
          {t("fork_update_confirm_ok")}
        </button>
        <button
          type="button"
          className="auto-update-sub-header__new-version-button fork-update-confirm__cancel"
          onClick={() => setShowConfirm(false)}
        >
          {t("fork_update_confirm_cancel")}
        </button>
      </header>
    );
  }

  if (downloadState === "downloading") {
    return (
      <header className="auto-update-sub-header fork-update-progress">
        <SyncIcon
          className="auto-update-sub-header__new-version-icon fork-update-progress__icon"
          size={12}
        />
        <span className="fork-update-progress__text">
          {t("fork_update_downloading", { percent: progress })}
        </span>
        <div className="fork-update-progress__bar">
          <div
            className="fork-update-progress__fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>
    );
  }

  if (downloadState === "downloaded") {
    return (
      <header className="auto-update-sub-header">
        <button
          type="button"
          className="auto-update-sub-header__new-version-button"
          onClick={handleInstallClick}
        >
          <SyncIcon
            className="auto-update-sub-header__new-version-icon"
            size={12}
          />
          {t("fork_update_install")} — Build #{updateInfo.runNumber}:{" "}
          {commitSnippet}
        </button>
      </header>
    );
  }

  return (
    <header className="auto-update-sub-header">
      <SyncIcon
        className="auto-update-sub-header__new-version-icon"
        size={12}
      />
      <span className="fork-update-available__text">
        {t("fork_update_available", { buildNumber: updateInfo.runNumber })}
        {commitSnippet && (
          <span className="fork-update-available__commit">
            {" "}
            — {commitSnippet}
          </span>
        )}
      </span>
      <button
        type="button"
        className="auto-update-sub-header__new-version-button fork-update-available__btn"
        onClick={handleDownload}
      >
        {t("fork_update_download")}
      </button>
      <button
        type="button"
        className="auto-update-sub-header__new-version-button fork-update-available__dismiss"
        onClick={handleDismiss}
      >
        {t("fork_update_dismiss")}
      </button>
    </header>
  );
}
