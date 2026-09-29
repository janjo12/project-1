import { useEffect, useState } from "react";

import {
  DEFAULT_GAME_SETTINGS,
  GameSettings,
  loadGameSettings,
  saveGameSettings,
} from "@/utils/settings-storage";
import { generateRandomSeed } from "@/utils/seed";

type UseGameSettingsOptions = {
  refreshSeedOnLoad?: boolean;
};

function settingsWithFreshSeed(settings: GameSettings) {
  // Setup screens opt into a fresh layout each visit while retaining other saved preferences.
  return {
    ...settings,
    seed: generateRandomSeed(),
  };
}

export function useGameSettings({
  refreshSeedOnLoad = false,
}: UseGameSettingsOptions = {}) {
  // Start with defaults for a stable first render, then hydrate saved values after mount.
  const [settings, setSettings] = useState<GameSettings>(() =>
    refreshSeedOnLoad
      ? settingsWithFreshSeed(DEFAULT_GAME_SETTINGS)
      : DEFAULT_GAME_SETTINGS,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadGameSettings().then((storedSettings) => {
      setSettings(
        refreshSeedOnLoad
          ? settingsWithFreshSeed(storedSettings)
          : storedSettings,
      );
      setIsLoading(false);
    });
  }, [refreshSeedOnLoad]);

  async function saveSettings(nextSettings: GameSettings) {
    setSettings(nextSettings);
    await saveGameSettings(nextSettings);
  }

  function updateSettings(partialSettings: Partial<GameSettings>) {
    // Merge partial edits so changing one control does not reset the other stored preferences.
    setSettings((currentSettings) => {
      const nextSettings = {
        ...currentSettings,
        ...partialSettings,
      };

      void saveGameSettings(nextSettings);

      return nextSettings;
    });
  }

  return {
    isLoading,
    settings,
    saveSettings,
    updateSettings,
  };
}
