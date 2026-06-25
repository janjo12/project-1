//#region imports
import { router } from "expo-router";
import { Alert } from "react-native";

import {
  Container,
  Footer,
  Header,
  Row,
  StyledText,
  Title,
} from "@/components/displays";
import {
  HelpButton,
  NormalButton,
  PrimaryButton,
  RadioGroup,
  SegmentedButton,
  TextEntry
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
            <NormalButton
              accessibilityLabel="Settings"
              accessibilityRole="button"
              icon="cog"
              onPress={handleOpenSettings}
              testID="open-settings-button"
            />
          </Header>
          <Title>[Project 1]</Title>
          <Container>
            <Row>
              <StyledText>Difficulty</StyledText>
              <SegmentedButton
                onChange={(difficulty) => updateSettings({ difficulty })}
                options={["easy", "normal", "hard"] as const}
                value={settings.difficulty}
              />
              <HelpButton
                accessibilityLabel="Difficulty help"
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(
                    "Difficulty",
                    "Easy removes the turn timer, normal keeps a steady timer, and hard shortens the timer while limiting your total turns by dungeon size.",
                  )
                }
              />
            </Row>

            <Row>
              <StyledText>Seed</StyledText>
              <TextEntry
                accessibilityLabel="Seed"
                accessibilityRole="textbox"
                onChangeText={(seed) => updateSettings({ seed })}
                placeholder="Random"
                value={settings.seed}
              />
              <HelpButton
                accessibilityLabel="Seed help"
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(
                    "Seed",
                    "A seed repeats the same dungeon layout. Leave it blank to generate a fresh random dungeon when you start.",
                  )
                }
              />
            </Row>

            <Row>
              <StyledText>Handedness</StyledText>
              <RadioGroup
                onChange={(handedness) => updateSettings({ handedness })}
                options={["left", "right"] as const}
                value={settings.handedness}
              />
              <HelpButton
                accessibilityLabel="Handedness help"
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(
                    "Handedness",
                    "Left or right changes the action layout so the controls sit closer to your preferred thumb.",
                  )
                }
              />
            </Row>
          </Container>

          <Footer>
            <PrimaryButton
              accessibilityLabel={isLoading ? "Loading" : "Start Game"}
              accessibilityRole="button"
              label={isLoading ? "Loading" : "Start"}
              onPress={handleStartGame}
            />
          </Footer>
        </Container>
      </ScreenShell>
    </ThemeProvider>
  );
}
