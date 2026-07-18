import { useEffect, useMemo, useState } from "react";
import {
  Button,
  FocusItem,
  Input,
  VerticalFocusGroup,
} from "../../components";
import { useBigPictureToast, useUserPreferences } from "../../hooks";
import { SettingsSection } from "./settings-section";
import type { FocusOverrideTarget, FocusOverrides } from "../../services";

const FOCUS_HYDRA = "steamgriddb-mode-hydra";
const FOCUS_CUSTOM = "steamgriddb-mode-custom";
const FOCUS_INPUT = "steamgriddb-input";
const FOCUS_SAVE = "steamgriddb-save";
const REGION = "steamgriddb-region";

interface Props {
  upTarget: FocusOverrideTarget;
  downTarget: FocusOverrideTarget;
}

export function SteamGridDbSection({ upTarget, downTarget }: Readonly<Props>) {
  const userPreferences = useUserPreferences();
  const { showSuccessToast } = useBigPictureToast();
  const [mode, setMode] = useState<"hydra" | "custom">("hydra");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    setMode(userPreferences?.steamGridDbMode ?? "hydra");
    setApiKey(userPreferences?.steamGridDbApiKey ?? "");
  }, [userPreferences]);

  const isCustom = mode === "custom";
  const showKeyWarning = isCustom && !apiKey.trim();

  const handleSave = async () => {
    await globalThis.window.electron.updateUserPreferences({
      steamGridDbMode: mode,
      steamGridDbApiKey: isCustom ? apiKey.trim() || null : null,
    });
    showSuccessToast("SteamGridDB settings saved", {
      fallbackVisual: "settings",
    });
  };

  const hydraNav = useMemo<FocusOverrides>(
    () => ({
      up: upTarget,
      down: { type: "item", itemId: FOCUS_CUSTOM },
    }),
    [upTarget, downTarget]
  );

  const customNav = useMemo<FocusOverrides>(
    () => ({
      up: { type: "item", itemId: FOCUS_HYDRA },
      down: isCustom
        ? { type: "item", itemId: FOCUS_INPUT }
        : downTarget,
    }),
    [isCustom, downTarget]
  );

  const inputNav = useMemo<FocusOverrides>(
    () => ({
      up: { type: "item", itemId: FOCUS_CUSTOM },
      right: { type: "item", itemId: FOCUS_SAVE },
      down: downTarget,
    }),
    [downTarget]
  );

  const saveNav = useMemo<FocusOverrides>(
    () => ({
      up: { type: "item", itemId: FOCUS_INPUT },
      left: { type: "item", itemId: FOCUS_INPUT },
      down: downTarget,
    }),
    [downTarget]
  );

  return (
    <SettingsSection
      title="SteamGridDB"
      description="Choose the artwork source for game icons, logos and heroes."
      className="integration-provider-section"
    >
      <VerticalFocusGroup regionId={REGION} asChild>
        <div className="integration-provider-section__content">
          <FocusItem
            id={FOCUS_HYDRA}
            asChild
            navigationOverrides={hydraNav}
            actions={{ primary: () => setMode("hydra") }}
          >
            <button
              type="button"
              className="integration-provider-section__radio"
              onClick={() => setMode("hydra")}
            >
              <span
                className={`integration-provider-section__radio-dot ${
                  !isCustom ? "integration-provider-section__radio-dot--active" : ""
                }`}
                aria-hidden="true"
              />
              Hydra API (recommended)
            </button>
          </FocusItem>

          <FocusItem
            id={FOCUS_CUSTOM}
            asChild
            navigationOverrides={customNav}
            actions={{ primary: () => setMode("custom") }}
          >
            <button
              type="button"
              className="integration-provider-section__radio"
              onClick={() => setMode("custom")}
            >
              <span
                className={`integration-provider-section__radio-dot ${
                  isCustom ? "integration-provider-section__radio-dot--active" : ""
                }`}
                aria-hidden="true"
              />
              Own SteamGridDB API key
            </button>
          </FocusItem>

          {isCustom ? (
            <div className="integration-provider-section__token-row">
              <Input
                id="steamgriddb-key"
                label="API Key"
                type="password"
                placeholder="SteamGridDB API key"
                value={apiKey}
                focusId={FOCUS_INPUT}
                focusNavigationOverrides={inputNav}
                autoComplete="off"
                onChange={(e) => setApiKey(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                focusId={FOCUS_SAVE}
                focusNavigationOverrides={saveNav}
                onClick={handleSave}
              >
                Save
              </Button>
            </div>
          ) : (
            <div className="integration-provider-section__token-row">
              <Button
                type="button"
                variant="secondary"
                focusId={FOCUS_SAVE}
                focusNavigationOverrides={saveNav}
                onClick={handleSave}
              >
                Save
              </Button>
            </div>
          )}

          {showKeyWarning ? (
            <p className="integration-provider-section__helper integration-provider-section__helper--idle">
              Set your SteamGridDB API key to use this mode.
            </p>
          ) : null}

          <p className="integration-provider-section__helper integration-provider-section__helper--idle">
            Get your API key at{" "}
            <a
              href="https://www.steamgriddb.com/profile/preferences/api"
              target="_blank"
              rel="noreferrer"
            >
              steamgriddb.com
            </a>
          </p>
        </div>
      </VerticalFocusGroup>
    </SettingsSection>
  );
}
