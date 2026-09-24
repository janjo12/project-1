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
    attackTravelDistance: 8,
    bounceDistance: 4,
    bounceDurationMs: 1400,
    damageDurationMs: 248,
    defendWindupMs: 150,
    enemyTurnDurationMs: 500,
    resourceLossDurationMs: 680,
  }),
  combat: Object.freeze({
    chargeEnergyCost: 10,
    chargedCounterattackDamage: 2,
    counterattackDamage: 1,
    defendDamageMultiplier: 0.5,
    normalAttackDamage: 10,
    strongAttackDamage: 20,
    strongAttackEnergyCost: 0,
    werewolfMeleeDamage: 0,
  }),
  dungeon: Object.freeze({
    mapWidthRooms: 12,
    mapHeightRooms: 6,
    baseRoomCount: 7,
    doorwayGuardsPerRoom: 0.5,
    extraRoomCountRange: 5,
    extraConnectionChance: 0.25,
    hardTurnsPerRoom: 3,
    lockedDoorChance: 0.7,
    maxRoomCount: 72,
    optionalLootChance: 0.1,
    equipmentRoomChance: 0.06,
    itemRoomChance: 0.1,
    werewolfChance: 0.45,
  }),
  monsters: Object.freeze([
    Object.freeze({ attack: 16, defense: 0, damage: 16, maximumHealth: 20, name: "Pixel Golem", sprite: "👾" }),
    Object.freeze({ attack: 17, defense: 0, damage: 17, maximumHealth: 50, name: "Zombie", sprite: "🧟" }),
    Object.freeze({ attack: 20, defense: 0, damage: 20, maximumHealth: 100, name: "Dragon", sprite: "🐉" }),
    Object.freeze({ attack: 18, defense: 0, damage: 18, maximumHealth: 70, name: "Vampire", sprite: "🧛" }),
    Object.freeze({ chases: true, attack: 19, defense: 0, damage: 19, maximumHealth: 80, name: "Werewolf", sprite: "🐺" }),
  ]),
  items: Object.freeze([
    Object.freeze({ id: "energy-meal", label: "Stamina Meal", description: "Energizes you when you run out of energy", sprite: "🍔" }),
    Object.freeze({ id: "health-potion", label: "Health Potion", description: "Heals you when you run out of health", sprite: "🧪" }),
    Object.freeze({ id: "key", label: "Key", description: "Opens a locked door", sprite: "🗝️" }),
    Object.freeze({ id: "silver-bullet", label: "Silver Bullet", description: "Kills a Werewolf", sprite: "🔫" }),
    Object.freeze({ id: "clock", label: "Clock", description: "Adds more turns when turns run out", sprite: "⏰" }),
  ]),
  equipment: Object.freeze([
    Object.freeze({ id: "good-armor", label: "Good Armor", description: "Increases Defense", sprite: "🛡️", attack: 0, defense: 5 }),
    Object.freeze({ id: "good-weapon", label: "Good Weapon", description: "Increases Attack Power", sprite: "⚔️", attack: 10, defense: 0 }),
    Object.freeze({ id: "heavy-armor", label: "Heavy Armor", description: "Greatly Boosts Defense, but lowers Attack", sprite: "🛡️", attack: -5, defense: 10 }),
    Object.freeze({ id: "heavy-weapon", label: "Heavy Weapon", description: "Greatly boosts Attack, but lowers Defense", sprite: "🪓", attack: 30, defense: -5 }),
    Object.freeze({ id: "amulet", label: "Amulet", description: "Reduces Energy cost", sprite: "📿", attack: 0, defense: 0, chargeCost: 5 }),
    Object.freeze({ id: "cursed-amulet", label: "Cursed Amulet", description: "Greatly reduces Energy cost, but hurts you each turn", sprite: "📿", attack: 0, defense: 0, chargeCost: 2, turnDamage: 1, hiddenDescription: true }),
    Object.freeze({ id: "spyglass", label: "Spyglass", description: "Peeks into adjacent rooms", sprite: "🔭", attack: 0, defense: 0 }),
  ]),
  player: Object.freeze({
    itemRecoveryFraction: 0.5,
    maxEnergy: 100,
    maxHealth: 100,
    attack: 10,
    defense: 10,
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
