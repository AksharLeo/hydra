import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, RadioField, TextField } from "@renderer/components";
import { useAppSelector, useToast } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import { LinkExternalIcon } from "@primer/octicons-react";

export function SettingsSteamGridDb() {
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );
  const { updateUserPreferences } = useContext(settingsContext);
  const { showSuccessToast, showErrorToast } = useToast();
  const { t } = useTranslation("settings");

  const [mode, setMode] = useState<"hydra" | "custom">("hydra");
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMode(userPreferences?.steamGridDbMode ?? "hydra");
    setApiKey(userPreferences?.steamGridDbApiKey ?? "");
  }, [userPreferences]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await updateUserPreferences({
        steamGridDbMode: mode,
        steamGridDbApiKey: mode === "custom" ? apiKey.trim() || null : null,
      });
      showSuccessToast(t("changes_saved"));
    } catch {
      showErrorToast(t("try_again"));
    } finally {
      setIsLoading(false);
    }
  };

  const showKeyWarning = mode === "custom" && !apiKey.trim();

  return (
    <div>
      <p
        style={{
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {t("steamgriddb_description")}
        <a
          href="https://www.steamgriddb.com/profile/preferences/api"
          target="_blank"
          rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          steamgriddb.com <LinkExternalIcon size={12} />
        </a>
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontWeight: 600 }}>{t("steamgriddb_source")}</span>
        <RadioField
          label={t("steamgriddb_source_hydra")}
          name="steamgriddb-source"
          value="hydra"
          checked={mode === "hydra"}
          onChange={() => setMode("hydra")}
        />
        <RadioField
          label={t("steamgriddb_source_custom")}
          name="steamgriddb-source"
          value="custom"
          checked={mode === "custom"}
          onChange={() => setMode("custom")}
        />

        {mode === "custom" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <TextField
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("steamgriddb_api_key_placeholder")}
              type="password"
              theme="dark"
            />
            <Button
              type="button"
              theme="outline"
              onClick={handleSave}
              disabled={isLoading}
            >
              {t("save")}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            theme="outline"
            onClick={handleSave}
            disabled={isLoading}
          >
            {t("save")}
          </Button>
        )}

        {showKeyWarning ? (
          <p style={{ color: "#f0a020", margin: 0 }}>
            {t("steamgriddb_key_required")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
