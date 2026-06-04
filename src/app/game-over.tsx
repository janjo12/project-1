import { router, useLocalSearchParams } from "expo-router";

import { EndScreen } from "@/components/end-screen";

export default function GameOverRoute() {
  const { score } = useLocalSearchParams<{ score?: string }>();
  const defeatedEnemies = Number(score);

  return (
    <EndScreen
      score={Number.isFinite(defeatedEnemies) ? String(defeatedEnemies) : "0"}
      onReturnToTitle={() => router.replace("/")}
    />
  );
}
