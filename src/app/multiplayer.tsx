import { router, useLocalSearchParams } from "expo-router";

import { MultiplayerScreen } from "@/components/Common/MultiplayerScreen";
import { ThemeProvider } from "@/components/Common/theme";
import { useGameSettings } from "@/hooks/use-game-settings";

export default function MultiplayerRoute() {
  const { host } = useLocalSearchParams<{ host?: string }>();
  const { settings, isLoading } = useGameSettings();
  if (isLoading) return null;

  return (
    <ThemeProvider appearance={settings.appearance}>
      <MultiplayerScreen
        settings={settings}
        startAsHost={host === "true"}
        onHostSelect={() => router.replace({ pathname: "/setup", params: { mode: "multiplayer", host: "true" } })}
        onPlaySolo={() => router.replace({ pathname: "/setup", params: { mode: "singleplayer" } })}
        onLeave={() => router.replace("/")}
      />
    </ThemeProvider>
  );
}
