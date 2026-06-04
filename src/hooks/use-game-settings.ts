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
  return {
    ...settings,
    seed: generateRandomSeed(),
  };
}

export function useGameSettings({
  refreshSeedOnLoad = false,
}: UseGameSettingsOptions = {}) {
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
