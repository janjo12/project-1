import { PLAYER_MAX_HEALTH } from "@/game/state/types";
import type { GameClassId } from "@/game/config/game-classes";

export function resolveClericMiracle({
  alreadyUsed,
  classId,
  healthAfterDamage,
  usedPotion,
}: {
  alreadyUsed: boolean;
  classId: GameClassId;
  healthAfterDamage: number;
  usedPotion: boolean;
}): { health: number; triggered: boolean } {
  if (classId !== "cleric" || alreadyUsed || usedPotion || healthAfterDamage > 0) {
    return { health: healthAfterDamage, triggered: false };
  }

  return { health: Math.ceil(PLAYER_MAX_HEALTH / 2), triggered: true };
}
