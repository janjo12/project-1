import type { GameClassId } from "@/game/config/game-classes";

export function getSupportFeedback(classId: GameClassId) {
  switch (classId) {
    case "warrior": return { emoji: "🛡️", label: "Vanguard" };
    case "cleric": return { emoji: "✨", label: "Aid" };
    case "thief": return { emoji: "🎁", label: "Enrich" };
    case "archer": return { emoji: "🎯", label: "Raise Focus" };
    case "wizard": return { emoji: "⚡", label: "Empower Attacks" };
  }
}
