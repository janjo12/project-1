import { applyDefense, getPlayerAttackDamage, resolveAttackDamage, resolveEnemyDamage } from "@/game/engine/combat";
import type { WorldMonster } from "@/game/entities/enemies";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { createMultiplayerState } from "@/game/engine/multiplayer-rules";
import { createMonster } from "@/game/entities/enemies";

const enemy: WorldMonster = { id: "e", type: "monster", name: "Enemy", sprite: "e", damage: 12, currentHealth: 9, maximumHealth: 20, defense: 2 };

describe("documented combat math", () => {
  it("selects ordinary attack profiles and leaves the Werewolf immune to ordinary attacks", () => {
    expect(getPlayerAttackDamage(enemy, false)).toBe(10);
    expect(getPlayerAttackDamage({ ...enemy, chases: true }, false)).toBe(0);
    expect(getPlayerAttackDamage({ ...enemy, chases: true }, true)).toBe(0);
    expect(resolveAttackDamage({ profile: 10, score: 100, target: { ...enemy, chases: true } })).toBe(0);
    expect(resolveAttackDamage({ profile: 20, score: 100, charged: true, target: { ...enemy, chases: true } })).toBe(0);
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
    const chargedAttackOutcomes = GAME_PARAMETERS.monsters.filter(monster => !("chases" in monster && monster.chases)).map((monster) => {
      const attackCount = Math.ceil(monster.maximumHealth / resolveAttackDamage({
        profile: getPlayerAttackDamage({ ...enemy, chases: "chases" in monster && monster.chases }, true),
        score: averageScore,
        charged: true,
        target: { ...enemy, currentHealth: monster.maximumHealth, defense: monster.defense },
      }));
      return {
        damageTaken: Math.max(0, attackCount - 1) * Math.max(0, monster.damage - GAME_PARAMETERS.player.defense),
        energySpent: attackCount * GAME_PARAMETERS.combat.chargeEnergyCost,
      };
    });

    expect(chargedAttackOutcomes.every(({ damageTaken }) => damageTaken < GAME_PARAMETERS.player.maxHealth)).toBe(true);
    expect(chargedAttackOutcomes.every(({ energySpent }) => energySpent <= GAME_PARAMETERS.player.maxEnergy)).toBe(true);
  });

  it("keeps weak monster stats at catalog values and scales all monsters with party size", () => {
    const ordinaryCatalog = GAME_PARAMETERS.monsters.filter(monster => !("chases" in monster && monster.chases));
    ordinaryCatalog.forEach((catalogMonster, index) => {
      const monster = createMonster(index, "A1", () => 0);
      expect(monster.maximumHealth).toBe(catalogMonster.maximumHealth);
      expect(monster.damage).toBe(catalogMonster.damage);
    });

    const solo = createMultiplayerState("testwarrior", "normal", ["host"]);
    const party = createMultiplayerState("testwarrior", "normal", ["host", "guest-1", "guest-2", "guest-3"]);
    const additionalPlayers = Object.keys(party.players).length - Object.keys(solo.players).length;
    const expectedHealthScale = 1 + additionalPlayers * GAME_PARAMETERS.monsterScaling.healthIncreasePerAdditionalPlayer;
    const expectedDamageScale = 1 + additionalPlayers * GAME_PARAMETERS.monsterScaling.damageIncreasePerAdditionalPlayer;
    const soloMonsters = Object.values(solo.map.entities.monsters);
    const partyMonsters = Object.values(party.map.entities.monsters);
    expect(partyMonsters.map(monster => monster.id)).toEqual(soloMonsters.map(monster => monster.id));
    expect(soloMonsters.length).toBeGreaterThan(0);
    soloMonsters.forEach(monster => {
      const partyMonster = party.map.entities.monsters[monster.id];
      expect(partyMonster.maximumHealth).toBe(Math.round(monster.maximumHealth * expectedHealthScale));
      expect(partyMonster.currentHealth).toBe(partyMonster.maximumHealth);
      expect(partyMonster.damage).toBe(Math.round(monster.damage * expectedDamageScale));
      expect(partyMonster.attack).toBe(Math.round((monster.attack ?? monster.damage) * expectedDamageScale));
    });
  });
});
