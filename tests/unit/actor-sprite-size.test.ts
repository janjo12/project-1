import { CREATURE_SPRITE_SIZE, getActorSpriteSize, getHumanFormScale, HUMAN_FORM_SPRITE_SIZE } from "@/utils/coordinates";

test("human-form actors share one adjustable sprite size", () => {
  const humanForms = [
    "warrior_graphic", "cleric_graphic", "thief_graphic",
    "zombie_graphic", "vampire_graphic", "werewolf_graphic",
  ];

  expect(humanForms.map(getActorSpriteSize)).toEqual(humanForms.map(() => HUMAN_FORM_SPRITE_SIZE));
  expect(getActorSpriteSize("dragon_graphic")).toBe(CREATURE_SPRITE_SIZE);
  expect(HUMAN_FORM_SPRITE_SIZE).toBeGreaterThan(CREATURE_SPRITE_SIZE);
});

test("human-form scale depends on party size, not the player's room position", () => {
  expect(getHumanFormScale(1)).toBe(1);
  expect(getHumanFormScale(4)).toBe(1);
  expect(getHumanFormScale(8)).toBe(1);
});
