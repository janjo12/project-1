// #region imports
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Container, Header, Title } from "@/components/displays";
import { ScreenActionButton, ToggleButton } from "@/components/inputs";
import { ScreenShell } from "@/components/screen-shell";
import { ThemeProvider } from "@/components/theme";

import { useGameSettings } from "@/hooks/use-game-settings";
//#endregion

export default function SettingsRoute() {
  const { settings, updateSettings } = useGameSettings();

  return (
    <ThemeProvider appearance={settings.appearance}>
      <ScreenShell>
        <Container>
          <Header>
            <ScreenActionButton
              accessibilityLabel="Back"
              label="Back"
              onPress={() => router.replace("/")}
            />
          </Header>

          <View style={styles.content}>
            <Title>Settings</Title>
            <ToggleButton
              label="Dark Mode"
              value={settings.appearance === "dark"}
              onValueChange={(value) => {
                updateSettings({ appearance: value ? "dark" : "light" });
              }}
            />
            <ToggleButton
              label="Vibration"
              value={settings.vibrationEnabled}
              onValueChange={(value) => {
                updateSettings({ vibrationEnabled: value });
              }}
            />
          </View>
        </Container>
      </ScreenShell>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 24,
    justifyContent: "center",
  },
});
