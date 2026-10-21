import { router } from "expo-router";
import { View } from "react-native";
import { Title, StyledText } from "@/components/Common/Displays";
import { PrimaryButton } from "@/components/Controls/ActionButton";
import { ScreenShell } from "@/components/Common/ScreenShell";
import { ThemeProvider } from "@/components/Common/theme";
import { useGameSettings } from "@/hooks/use-game-settings";

export default function Index() {
  const { settings } = useGameSettings();
  return <ThemeProvider appearance={settings.appearance}><ScreenShell>
    <View style={{ flex: 1, justifyContent: "center", gap: 24, width: "100%" }}>
      <View style={{ alignItems: "center", gap: 16 }}>
        <Title>[Project 1]</Title>
        <StyledText style={{ textAlign: "center" }}>How would you like to play?</StyledText>
      </View>
      <View style={{ gap: 16, width: "100%" }}>
        <PrimaryButton accessibilityLabel="Singleplayer" accessibilityRole="button" label="Singleplayer"
          onPress={() => router.push({ pathname: "/setup", params: { mode: "singleplayer" } })} />
        <PrimaryButton accessibilityLabel="Multiplayer" accessibilityRole="button" label="Multiplayer"
          onPress={() => router.push({ pathname: "/setup", params: { mode: "multiplayer" } })} />
      </View>
    </View>
  </ScreenShell></ThemeProvider>;
}
