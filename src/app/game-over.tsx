//#region imports
import { router, useLocalSearchParams } from "expo-router";

import { Container, Title } from "@/components/displays";
import { PrimaryButton } from "@/components/inputs";
import { ScreenShell } from "@/components/screen-shell";
import {
  ThemeProvider
} from "@/components/theme";

import { useGameSettings } from "@/hooks/use-game-settings";
//#endregion

export default function GameOverRoute() {
  const { score } = useLocalSearchParams<{ score?: string }>();
  const onReturnToTitle = () => {
    router.replace("/");
  };

  return (
    <ThemeProvider appearance={useGameSettings().settings.appearance}>
      <ScreenShell>
        <Container>
          <Title>{"\n\n\n"}Game Over</Title>

          <Title>
            {"\n"}Score: {score ?? "0"}{"\n"}
          </Title>

          <PrimaryButton 
            accessibilityLabel="Return to Title"
            accessibilityRole="button"
            label="Return to Title" onPress={onReturnToTitle} />
        </Container>
      </ScreenShell>
    </ThemeProvider>
  );
}