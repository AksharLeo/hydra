import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmationModal } from "@renderer/components";
import { getGameExecutableFilters } from "@shared";

interface PostInstallerModalProps {
  visible: boolean;
  shop: string;
  objectId: string;
  folderPath: string;
  onClose: () => void;
}

export function PostInstallerModal({
  visible,
  shop,
  objectId,
  folderPath,
  onClose,
}: Readonly<PostInstallerModalProps>) {
  const { t } = useTranslation("downloads");
  const [step, setStep] = useState<"select-exe" | "delete-folder">(
    "select-exe"
  );

  const handleSelectExecutable = async () => {
    const filters = getGameExecutableFilters(window.electron.platform, {
      executable: t("installer_select_executable"),
      allFiles: t("all_files", { ns: "game_details" }),
    });

    const { filePaths } = await window.electron.showOpenDialog({
      properties: ["openFile"],
      filters,
    });

    if (filePaths?.[0]) {
      await window.electron.updateExecutablePath(
        shop as any,
        objectId,
        filePaths[0]
      );
    }

    setStep("delete-folder");
  };

  const handleDeleteFolder = async () => {
    await window.electron.deleteInstallerFolder(folderPath);
    handleClose();
  };

  const handleClose = () => {
    setStep("select-exe");
    onClose();
  };

  if (step === "select-exe") {
    return (
      <ConfirmationModal
        visible={visible}
        title={t("installer_closed_title")}
        descriptionText={t("installer_closed_description")}
        confirmButtonLabel={t("installer_select_executable")}
        cancelButtonLabel={t("no")}
        onConfirm={handleSelectExecutable}
        onClose={handleClose}
      />
    );
  }

  return (
    <ConfirmationModal
      visible={visible}
      title={t("installer_delete_folder_title")}
      descriptionText={t("installer_delete_folder_description", {
        folderPath,
      })}
      confirmButtonLabel={t("yes")}
      cancelButtonLabel={t("no")}
      onConfirm={handleDeleteFolder}
      onClose={handleClose}
    />
  );
}
