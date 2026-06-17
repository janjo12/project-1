import { router } from "expo-router";

import { GameScreen } from "@/components/game-screen";
import { ThemeProvider } from "@/components/theme";
import { useGameSettings } from "@/hooks/use-game-settings";

export default function GameRoute() {
  const { isLoading, settings, updateSettings } = useGameSettings();

  if (isLoading) {
    return null;
  }

  return (
    <ThemeProvider appearance={settings.appearance}>
      <GameScreen
        difficulty={settings.difficulty}
        handedness={settings.handedness}
        onSettingsChange={updateSettings}
        seed={settings.seed}
        settings={settings}
        vibrationEnabled={settings.vibrationEnabled}
        onQuitToTitle={() => router.replace("/")}
        onGameOver={(score) =>
          router.replace({
            pathname: "/game-over",
            params: { score: String(score) },
          })
        }
      />
    </ThemeProvider>
  );
}
