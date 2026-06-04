import { router } from "expo-router";

import { StartScreen } from "@/components/start-screen";
import { useGameSettings } from "@/hooks/use-game-settings";

export default function Index() {
  const { isLoading, settings, updateSettings, saveSettings } =
    useGameSettings();

  const handleStartGame = async () => {
    await saveSettings(settings);
    router.replace("/game");
  };

  return (
    <StartScreen
      isLoading={isLoading}
      settings={settings}
      onSettingsChange={updateSettings}
      onStartGame={handleStartGame}
    />
  );
}
