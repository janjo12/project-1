/**
 * Designer-owned tuning values.
 *
 * Keep gameplay balance, timing, animation, and procedural-generation knobs here so
 * designers can tune the game without hunting through implementation files.
 */
export const GAME_PARAMETERS = Object.freeze({
  animation: Object.freeze({
    attackDurationMs: 500,
    attackImpactDelayMs: 250,
    attackTravelDistance: 20,
    bounceDistance: 10,
    bounceDurationMs: 1400,
    damageDurationMs: 248,
    defendWindupMs: 150,
    enemyTurnDurationMs: 500,
    resourceLossDurationMs: 680,
  }),
  combat: Object.freeze({
    counterattackDamage: 1,
    defendDamageMultiplier: 0.5,
    normalAttackDamage: 1,
    strongAttackDamage: 2,
    strongAttackEnergyCost: 1,
    werewolfMeleeDamage: 0,
  }),
  dungeon: Object.freeze({
    baseRoomCount: 7,
    doorwayGuardsPerRoom: 0.5,
    extraRoomCountRange: 5,
    extraConnectionChance: 0.25,
    hardTurnsPerRoom: 3,
    lockedDoorChance: 0.7,
    maxRoomCount: 72,
    optionalLootChance: 0.45,
    werewolfChance: 0.45,
  }),
  monsters: Object.freeze([
    Object.freeze({ damage: 1, maximumHealth: 1, name: "Pixel Golem", sprite: "👾" }),
    Object.freeze({ damage: 1, maximumHealth: 4, name: "Zombie", sprite: "🧟" }),
    Object.freeze({ damage: 2, maximumHealth: 2, name: "Dragon", sprite: "🐉" }),
    Object.freeze({ damage: 1, maximumHealth: 3, name: "Vampire", sprite: "🧛" }),
    Object.freeze({ chases: true, damage: 1, maximumHealth: 1, name: "Werewolf", sprite: "🐺" }),
  ]),
  items: Object.freeze([
    Object.freeze({ id: "energy-meal", label: "Energy Meal", sprite: "🍔" }),
    Object.freeze({ id: "health-potion", label: "Health Potion", sprite: "🧪" }),
    Object.freeze({ id: "key", label: "Key", sprite: "🗝️" }),
    Object.freeze({ id: "silver-bullet", label: "Silver Bullet", sprite: "🔫" }),
    Object.freeze({ id: "clock", label: "Clock", sprite: "⏰" }),
  ]),
  player: Object.freeze({
    itemRecoveryFraction: 0.5,
    maxEnergy: 6,
    maxHealth: 10,
  }),
  turn: Object.freeze({
    clockBaseTurns: 5,
    hardBaseDurationMs: 5000,
    hardFallbackLimit: 30,
    minimumDurationMs: 2000,
    normalBaseDurationMs: 6000,
    durationReductionPerLevelMs: 30,
    gameLoopTickMs: 100,
  }),
});
