import { router } from "expo-router";

import { Container, Header, Row, StyledText, Title } from "@/components/Common/Displays";
import { CancelButton, SegmentedButton, ToggleButton } from "@/components/Controls/ActionButton";
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
            <Row>
              <StyledText>Appearance</StyledText>
              <SegmentedButton
                onChange={(appearance) => updateSettings({ appearance: appearance.toLowerCase() as typeof settings.appearance })}
                options={["System", "Light", "Dark"] as const}
                value={settings.appearance[0].toUpperCase() + settings.appearance.slice(1)}
              />
            </Row>
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
