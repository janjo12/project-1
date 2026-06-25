// #region imports
import { router } from "expo-router";

import { Container, Header, Title } from "@/components/displays";
import { CancelButton, ToggleButton } from "@/components/inputs";
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
            <CancelButton
              accessibilityLabel="Back"
              accessibilityRole="button"
              label="Back"
              onPress={() => router.replace("/")}
            />
          </Header>

          <Container>
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
          </Container>
        </Container>
      </ScreenShell>
    </ThemeProvider>
  );
}
