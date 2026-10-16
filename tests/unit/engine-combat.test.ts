import { applyDefense, getPlayerAttackDamage, resolveAttackDamage, resolveEnemyDamage } from "@/game/engine/combat";
import type { WorldMonster } from "@/game/entities/enemies";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";

const enemy: WorldMonster = { id: "e", type: "monster", name: "Enemy", sprite: "e", damage: 12, currentHealth: 9, maximumHealth: 20, defense: 2 };

describe("documented combat math", () => {
  it("selects ordinary and Werewolf attack profiles by charge state", () => {
    expect(getPlayerAttackDamage(enemy, false)).toBe(10);
    expect(getPlayerAttackDamage({ ...enemy, chases: true }, true)).toBe(15);
  });
  it("scales attack by score, adds equipment and charged bonus, then applies target defense", () => {
    expect(resolveAttackDamage({ profile: 20, score: 50, equipmentAttack: 3, charged: true, target: { ...enemy, currentHealth: 100 } })).toBe(16);
  });
  it("caps damage to remaining health and never heals from negative inputs", () => {
    expect(resolveAttackDamage({ profile: 10, score: 100, target: enemy })).toBe(8);
    expect(resolveAttackDamage({ profile: 10, score: -10, target: { ...enemy, currentHealth: 20, defense: 0 } })).toBe(1);
  });
  it("applies defense without allowing negative damage", () => {
    expect(applyDefense(12, 10)).toBe(2);
    expect(resolveEnemyDamage(8, 10)).toBe(0);
  });
  it("keeps catalog health within a survivable number of average-score turns", () => {
    const averageScore = 80;
    const nonWarriorDamageTaken = GAME_PARAMETERS.monsters.map((monster) => {
      const attackCount = Math.ceil(monster.maximumHealth / resolveAttackDamage({
        profile: getPlayerAttackDamage({ ...enemy, chases: "chases" in monster && monster.chases }, false),
        score: averageScore,
        target: { ...enemy, currentHealth: monster.maximumHealth, defense: monster.defense },
      }));
      return Math.max(0, attackCount - 1) * Math.max(0, monster.damage - GAME_PARAMETERS.player.defense);
    });

    expect(GAME_PARAMETERS.monsters.map(({ maximumHealth }) => maximumHealth)).toEqual([20, 40, 80, 60, 60]);
    expect(nonWarriorDamageTaken.every((damage) => damage < GAME_PARAMETERS.player.maxHealth)).toBe(true);
  });
});
