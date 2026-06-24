//#region imports
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { Container, Title } from "@/components/displays";
import { AppButton } from "@/components/inputs";
import { ScreenShell } from "@/components/screen-shell";
import {
  type ThemeColors,
  ThemeProvider,
  useThemeColors,
} from "@/components/theme";

import { useGameSettings } from "@/hooks/use-game-settings";
import { generateRandomSeed } from "@/utils/seed";
//#endregion

const GAME_OVER_COPY = {
  returnAction: "Return to Title",
  scoreLabel: "Score",
  titleLines: ["Game", "Over"],
};

export default function GameOverRoute() {
  const { score } = useLocalSearchParams<{ score?: string }>();
  const { isLoading, saveSettings, settings } = useGameSettings();
  const clearedLevels = Number(score);

  const handleReturnToTitle = async () => {
    await saveSettings({
      ...settings,
      seed: generateRandomSeed(),
    });
    router.replace("/");
  };

  if (isLoading) {
    return null;
  }

  return (
    <ThemeProvider appearance={settings.appearance}>
      <EndScreen
        copy={GAME_OVER_COPY}
        score={Number.isFinite(clearedLevels) ? String(clearedLevels) : "0"}
        onReturnToTitle={handleReturnToTitle}
      />
    </ThemeProvider>
  );
}


type EndScreenCopy = {
  returnAction: string;
  scoreLabel: string;
  titleLines: string[];
};

type EndScreenProps = {
  copy: EndScreenCopy;
  onReturnToTitle: () => void;
  score: string;
};

export function EndScreen({
  copy,
  score,
  onReturnToTitle,
}: EndScreenProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <ScreenShell>
      <Container>
        {copy.titleLines.map((line) => (
          <Title key={line}>{line}</Title>
        ))}

        <Text style={styles.score}>
          {copy.scoreLabel}: {score}
        </Text>

        <AppButton label={copy.returnAction} onPress={onReturnToTitle} />
      </Container>
    </ScreenShell>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    score: {
      color: colors.fadedInk,
      fontSize: 38,
      fontVariant: ["tabular-nums"],
      fontWeight: "500",
      textAlign: "center",
    },
  });
}
