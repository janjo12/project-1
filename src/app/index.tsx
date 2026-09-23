import { router } from "expo-router";
import { Title, StyledText } from "@/components/displays";
import { PrimaryButton } from "@/components/inputs";
import { ScreenShell } from "@/components/screen-shell";
import { ThemeProvider } from "@/components/theme";
import { useGameSettings } from "@/hooks/use-game-settings";

export default function Index() {
  const { settings } = useGameSettings();
  return <ThemeProvider appearance={settings.appearance}><ScreenShell>
    <Title>[Project 1]</Title>
    <StyledText>How would you like to play?</StyledText>
    <PrimaryButton accessibilityLabel="Singleplayer" accessibilityRole="button" label="Singleplayer"
      onPress={() => router.push({ pathname: "/setup", params: { mode: "singleplayer" } })} />
    <PrimaryButton accessibilityLabel="Multiplayer" accessibilityRole="button" label="Multiplayer · Same Wi-Fi"
      onPress={() => router.push({ pathname: "/setup", params: { mode: "multiplayer" } })} />
    <StyledText>Multiplayer: explore a shared dungeon, with one character on each device.</StyledText>
  </ScreenShell></ThemeProvider>;
}
