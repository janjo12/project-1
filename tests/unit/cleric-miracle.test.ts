import { resolveClericMiracle } from "@/game/engine/cleric-miracle";
import { PLAYER_MAX_HEALTH } from "@/game/state/types";

test("Miracle prevents lethal damage once per level and restores half maximum Health", () => {
  const first = resolveClericMiracle({
    alreadyUsed: false,
    classId: "cleric",
    healthAfterDamage: -12,
    usedPotion: false,
  });

  expect(first).toEqual({ health: Math.ceil(PLAYER_MAX_HEALTH / 2), triggered: true });

  const second = resolveClericMiracle({
    alreadyUsed: true,
    classId: "cleric",
    healthAfterDamage: -12,
    usedPotion: false,
  });

  expect(second).toEqual({ health: -12, triggered: false });
});

test.each([
  { classId: "warrior" as const, healthAfterDamage: 0, usedPotion: false },
  { classId: "cleric" as const, healthAfterDamage: 1, usedPotion: false },
  { classId: "cleric" as const, healthAfterDamage: 0, usedPotion: true },
])("Miracle does not trigger when its conditions are not met: %o", options => {
  expect(resolveClericMiracle({ ...options, alreadyUsed: false })).toEqual({
    health: options.healthAfterDamage,
    triggered: false,
  });
});
