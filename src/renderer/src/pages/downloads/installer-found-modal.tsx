import { useTranslation } from "react-i18next";
import { ConfirmationModal } from "@renderer/components";

interface InstallerFoundModalProps {
  visible: boolean;
  exePath: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function InstallerFoundModal({
  visible,
  exePath,
  onConfirm,
  onClose,
}: Readonly<InstallerFoundModalProps>) {
  const { t } = useTranslation("downloads");

  const fileName = exePath.split(/[/\\]/).pop() ?? exePath;

  return (
    <ConfirmationModal
      visible={visible}
      title={t("installer_found_title")}
      descriptionText={t("installer_found_description", { fileName })}
      confirmButtonLabel={t("installer_found_launch")}
      cancelButtonLabel={t("no")}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
