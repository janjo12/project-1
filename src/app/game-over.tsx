import { router, useLocalSearchParams } from "expo-router";

import { Container, Title } from "@/components/Common/Displays";
import { PrimaryButton } from "@/components/Controls/ActionButton";
import { ScreenShell } from "@/components/Common/ScreenShell";
import {
  ThemeProvider
} from "@/components/Common/theme";

import { useGameSettings } from "@/hooks/use-game-settings";

export default function GameOverRoute() {
  const { score } = useLocalSearchParams<{ score?: string }>();
  const onReturnToTitle = () => {
    router.replace("/");
  };

  return (
    <ThemeProvider appearance={useGameSettings().settings.appearance}>
      <ScreenShell>
        <Container>
          <Title>Game Over</Title>

          <Title>
            Score: {score ?? "0"}
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
