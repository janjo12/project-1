import { router, useLocalSearchParams } from "expo-router";

import { EndScreen } from "@/components/end-screen";
import { ThemeProvider } from "@/components/theme";
import { useGameSettings } from "@/hooks/use-game-settings";
import { generateRandomSeed } from "@/utils/seed";

export default function GameOverRoute() {
  const { score } = useLocalSearchParams<{ score?: string }>();
  const { isLoading, saveSettings, settings } = useGameSettings();
  const defeatedEnemies = Number(score);

  const handleReturnToTitle = async () => {
    await saveSettings({
      ...settings,
      seed: generateRandomSeed(),
    });
    router.replace("/");
  };

  if (isLoading) {
    return null;
  }

  return (
    <ThemeProvider appearance={settings.appearance}>
      <EndScreen
        score={Number.isFinite(defeatedEnemies) ? String(defeatedEnemies) : "0"}
        onReturnToTitle={handleReturnToTitle}
      />
    </ThemeProvider>
  );
}
