//#region imports
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import {
  Container,
  Footer,
  Header,
  Row,
  StyledModal,
  StyledText,
  Title,
} from "@/components/displays";
import {
  HelpButton,
  NormalButton,
  PrimaryButton,
  SegmentedButton,
  TextEntry
} from "@/components/inputs";
import { ScreenShell } from "@/components/screen-shell";
import { ThemeProvider } from "@/components/theme";
import { useGameSettings } from "@/hooks/use-game-settings";
import { generateRandomSeed } from "@/utils/seed";
//#endregion

const helpContent = {
  difficulty: {
    body: "Choose Easy for a casual experience. Normal requires you to beat each level in a limited number of turns. Hard keeps that turn limit and adds a timer for every turn.",
    title: "Difficulty",
  },
  seed: {
    body: "Used for determining the random layout of each level.",
    title: "Seed",
  },
} as const;

type HelpTopic = keyof typeof helpContent;

export default function Setup() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { isLoading, settings, updateSettings, saveSettings } =
    useGameSettings({ refreshSeedOnLoad: true });
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);
  const activeHelp = helpTopic ? helpContent[helpTopic] : null;

  const handleStartGame = async () => {
    const nextSettings = {
      ...settings,
      seed: settings.seed.trim() || generateRandomSeed(),
    };

    await saveSettings(nextSettings);
    router.replace(mode === "multiplayer" ? "/multiplayer" : "/game");
  };

  const handleOpenSettings = () => {
    router.push("/settings");
  };

  return (
    <ThemeProvider appearance={settings.appearance}>
      <ScreenShell>
        <Container>
          <Header><NormalButton accessibilityLabel="Back" accessibilityRole="button" label="Back" onPress={() => router.replace("/")} />
            <NormalButton
              accessibilityLabel="Settings"
              accessibilityRole="button"
              icon="cog"
              onPress={handleOpenSettings}
              testID="open-settings-button"
            />
          </Header>
          <Title>{"\n"}[Project 1]{"\n"}</Title>
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
                onPress={() => setHelpTopic("difficulty")}
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
                onPress={() => setHelpTopic("seed")}
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
        <StyledModal
          accessibilityLabel={activeHelp ? `${activeHelp.title} help` : "Help"}
          accessibilityRole="dialog"
          animationType="fade"
          onRequestClose={() => setHelpTopic(null)}
          visible={activeHelp !== null}
        >
          {activeHelp ? (
            <>
              <Title>{activeHelp.title}</Title>
              <StyledText>{activeHelp.body}</StyledText>
              <PrimaryButton
                accessibilityLabel="Close help"
                accessibilityRole="button"
                label="Got it"
                onPress={() => setHelpTopic(null)}
              />
            </>
          ) : null}
        </StyledModal>
      </ScreenShell>
    </ThemeProvider>
  );
}

