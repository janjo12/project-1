import { router } from "expo-router";

import { GameScreen } from "@/components/game-screen";
import { ThemeProvider } from "@/components/theme";
import { useGameSettings } from "@/hooks/use-game-settings";

export default function GameRoute() {
  const { isLoading, settings } = useGameSettings();

  if (isLoading) {
    return null;
  }

  return (
    <ThemeProvider appearance={settings.appearance}>
      <GameScreen
        handedness={settings.handedness}
        seed={settings.seed}
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
