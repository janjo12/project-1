import { router } from "expo-router";

import { GameScreen } from "@/components/game-screen";
import { useGameSettings } from "@/hooks/use-game-settings";

export default function GameRoute() {
  const { settings } = useGameSettings();

  return (
    <GameScreen
      handedness={settings.handedness}
      onGameOver={(score) =>
        router.replace({
          pathname: "/game-over",
          params: { score: String(score) },
        })
      }
    />
  );
}
