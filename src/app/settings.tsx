import { router } from "expo-router";

import { SettingsScreen } from "@/components/settings-screen";
import { ThemeProvider } from "@/components/theme";
import { useGameSettings } from "@/hooks/use-game-settings";

export default function SettingsRoute() {
  const { settings, updateSettings } = useGameSettings();

  return (
    <ThemeProvider appearance={settings.appearance}>
      <SettingsScreen
        settings={settings}
        onReturnToTitle={() => router.replace("/")}
        onSettingsChange={updateSettings}
      />
    </ThemeProvider>
  );
}
