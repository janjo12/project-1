import { getSupportFeedback } from "@/game/engine/support-feedback";

test.each([
  ["warrior", "🛡️", "Vanguard"],
  ["cleric", "✨", "Aid"],
  ["thief", "🎁", "Enrich"],
] as const)("%s support has a clear visual cue", (classId, emoji, label) => {
  expect(getSupportFeedback(classId)).toEqual({ emoji, label });
});
