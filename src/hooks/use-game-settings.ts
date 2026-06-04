import { useEffect, useState } from "react";

import {
  DEFAULT_GAME_SETTINGS,
  GameSettings,
  loadGameSettings,
  saveGameSettings,
} from "@/utils/settings-storage";

export function useGameSettings() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadGameSettings().then((storedSettings) => {
      setSettings(storedSettings);
      setIsLoading(false);
    });
  }, []);

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
