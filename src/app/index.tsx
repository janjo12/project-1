import { router } from "expo-router";

import { StartScreen } from "@/components/start-screen";
import { ThemeProvider } from "@/components/theme";
import { useGameSettings } from "@/hooks/use-game-settings";
import { generateRandomSeed } from "@/utils/seed";

export default function Index() {
  const { isLoading, settings, updateSettings, saveSettings } =
    useGameSettings({ refreshSeedOnLoad: true });

  const handleStartGame = async () => {
    const nextSettings = {
      ...settings,
      seed: settings.seed.trim() || generateRandomSeed(),
    };

    await saveSettings(nextSettings);
    router.replace("/game");
  };

  return (
    <ThemeProvider appearance={settings.appearance}>
      <StartScreen
        isLoading={isLoading}
        settings={settings}
        onSettingsChange={updateSettings}
        onStartGame={handleStartGame}
      />
    </ThemeProvider>
  );
}
