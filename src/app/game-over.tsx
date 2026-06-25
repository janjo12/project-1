//#region imports
import { router, useLocalSearchParams } from "expo-router";

import { Container, StyledText, Title } from "@/components/displays";
import { PrimaryButton } from "@/components/inputs";
import { ScreenShell } from "@/components/screen-shell";
import {
  ThemeProvider
} from "@/components/theme";

import { useGameSettings } from "@/hooks/use-game-settings";
//#endregion

export default function GameOverRoute() {
  const { score } = useLocalSearchParams<{ score?: string }>();

  return (
    <GameOverScreen
      score={score ?? "0"}
      onReturnToTitle={() => router.replace("/")}
    />
  );
}

export function GameOverScreen({
  score, onReturnToTitle}: {score: string; onReturnToTitle: () => void}) {

  return (
    <ThemeProvider appearance={useGameSettings().settings.appearance}>
      <ScreenShell>
        <Container>
          <Title>Game Over</Title>

          <StyledText>
            Score: {score}
          </StyledText>

          <PrimaryButton 
            accessibilityLabel="Return to Title"
            accessibilityRole="button"
            label="Return to Title" onPress={onReturnToTitle} />
        </Container>
      </ScreenShell>
    </ThemeProvider>
  );
}
