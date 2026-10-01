import { useSyncExternalStore } from "react";

import { ResourceBar } from "@/components/Player/PlayerHUD";
import type { NumberStore } from "@/game/state/numberStore";

type TurnTimerBarProps = {
  accessibilityLabel: string;
  color: string;
  max: number;
  panelPosition?: "first" | "last" | "middle" | "single";
  store: NumberStore;
  testID: string;
  compact?: boolean;
};

export function TurnTimerBar({ store, ...props }: TurnTimerBarProps) {
  const current = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return <ResourceBar {...props} current={current} icon="hourglass-half" />;
}
