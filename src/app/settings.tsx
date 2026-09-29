import { router } from "expo-router";

import { Container, Header, Title } from "@/components/Common/Displays";
import { CancelButton, ToggleButton } from "@/components/Controls/ActionButton";
import { ScreenShell } from "@/components/Common/ScreenShell";
import { ThemeProvider } from "@/components/Common/theme";

import { useGameSettings } from "@/hooks/use-game-settings";

export default function SettingsRoute() {
  // useGameSettings persists each toggle, so preferences survive leaving this screen or restarting.
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
              onPress={() => router.canGoBack() ? router.back() : router.replace("/")}
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
            <ToggleButton
              label="Left-handed controls"
              value={settings.handedness === "left"}
              onValueChange={(value) => {
                updateSettings({ handedness: value ? "left" : "right" });
              }}
            />
          </Container>
        </Container>
      </ScreenShell>
    </ThemeProvider>
  );
}
