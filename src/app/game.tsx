import { router } from "expo-router";

import { SingleplayerScreen } from "../../app/RunScreens";
import { ThemeProvider } from "@/components/Common/theme";
import { useGameSettings } from "@/hooks/use-game-settings";

export default function GameScreen() {
  const { isLoading, settings, updateSettings } = useGameSettings();
  if (isLoading) return null;

  return (
    <ThemeProvider appearance={settings.appearance}>
      <SingleplayerScreen
        settings={settings}
        onSettingsChange={updateSettings}
        onGameOver={score => router.replace({ pathname: "/game-over", params: { score: String(score) } })}
        onExit={() => router.replace("/")}
        onBackToSetup={() => router.replace({ pathname: "/setup", params: { mode: "singleplayer" } })}
      />
    </ThemeProvider>
  );
}
