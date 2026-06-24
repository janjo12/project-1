//#region imports
import { router } from "expo-router";
import { Alert } from "react-native";

import {
  Container,
  Footer,
  FormField,
  Header,
  Title,
} from "@/components/displays";
import {
  AppButton,
  RadioGroup,
  ScreenActionButton,
  SegmentedButton,
  TextEntry,
} from "@/components/inputs";
import { ScreenShell } from "@/components/screen-shell";
import { ThemeProvider } from "@/components/theme";
import { useGameSettings } from "@/hooks/use-game-settings";
import { generateRandomSeed } from "@/utils/seed";
//#endregion

export default function Index() {
  const { isLoading, settings, updateSettings, saveSettings } =
    useGameSettings({ refreshSeedOnLoad: true });

  const handleStartGame = async () => {
    const nextSettings = {
      ...settings,
      seed: settings.seed.trim() || generateRandomSeed(),
    };

    await saveSettings(nextSettings);
    router.replace("/game");
  };

  const handleOpenSettings = () => {
    router.push("/settings");
  };

  return (
    <ThemeProvider appearance={settings.appearance}>
      <ScreenShell>
        <Container>
          <Header>
            <ScreenActionButton
              accessibilityLabel="Settings"
              icon="cog"
              onPress={handleOpenSettings}
              testID="open-settings-button"
            />
          </Header>
          <Title>[Title]</Title>
          <Container>
            <FormField
              helpLabel="Difficulty help"
              label="Difficulty"
              onHelpPress={() =>
                Alert.alert(
                  "Difficulty",
                  "Easy removes the turn timer, normal keeps a steady timer, and hard shortens the timer while limiting your total turns by dungeon size.",
                )
              }
            >
              <SegmentedButton
                onChange={(difficulty) => updateSettings({ difficulty })}
                options={["easy", "normal", "hard"] as const}
                value={settings.difficulty}
              />
            </FormField>

            <FormField
              helpLabel="Seed help"
              label="Seed"
              onHelpPress={() =>
                Alert.alert(
                  "Seed",
                  "A seed repeats the same dungeon layout. Leave it blank to generate a fresh random dungeon when you start.",
                )
              }
            >
              <TextEntry
                accessibilityLabel="Seed"
                onChangeText={(seed) => updateSettings({ seed })}
                placeholder="Random"
                value={settings.seed}
              />
            </FormField>

            <FormField
              helpLabel="Handedness help"
              label="Handedness"
              onHelpPress={() =>
                Alert.alert(
                  "Handedness",
                  "Left or right changes the action layout so the controls sit closer to your preferred thumb.",
                )
              }
            >
              <RadioGroup
                onChange={(handedness) => updateSettings({ handedness })}
                options={["left", "right"] as const}
                value={settings.handedness}
              />
            </FormField>
          </Container>

          <Footer>
            <AppButton
              label={isLoading ? "Loading" : "Start"}
              onPress={handleStartGame}
            />
          </Footer>
        </Container>
      </ScreenShell>
    </ThemeProvider>
  );
}
