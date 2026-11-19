import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { createLevelMap } from "@/game/engine/run-game-level";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/game/state/types";
import { getHardTurnLimit, resolveTurnLoss } from "@/game/engine/resolveTurn";
import { getNeighborInGrid, getRoomId, placeDoorwayGuard, setConnectionBoundary, POSSIBLE_EQUIPMENT, POSSIBLE_ITEMS, type Direction, type DungeonMap } from "@/game/dungeon/types";
import { createMonster } from "@/game/entities/enemies";
import { createEquipment, createItem } from "@/game/entities/items";
import {
  addEquipmentToRoom,
  addItemToRoom,
  damageMonsterInRoom,
  getConnectedRoomId,
  getRoom,
  getRoomEquipment,
  getRoomEquipmentById,
  getRoomItem,
  getRoomItemById,
  getRoomMonster,
  getWerewolf,
  getTargetableMonsters,
  hasRoomStairs,
  moveCurrentPosition,
  removeEquipmentFromRoom,
  moveWerewolfToRoom,
  revealRoomLootChest,
  unlockDoor,
} from "@/game/dungeon/rooms";
import { applyDefense, getEquipmentStats, recoverStat, resolveEnergyLoss, resolveHealthLoss } from "@/game/actions/items";
import { resolveClericMiracle } from "@/game/engine/cleric-miracle";
import { gameClassForSeed, randomGameClass, type GameClassId } from "@/game/config/game-classes";
import { getPlayerAttackDamage, getWarriorRiposteDamage, resolveAttackDamage, scaleDefenseMicrogameScore } from "@/game/engine/combat";
import type { Difficulty } from "@/utils/settings-storage";
import { isMultiplayerPlayerOptions, type MultiplayerPlayerOptions } from "@/multiplayer/player-options";

export type GameState = { turn: number; [key: string]: unknown };
export type PlayerAction = {
  type: "MOVE" | "ATTACK" | "SUPPORT" | "CLASS_READY" | "PICKUP" | "PICKUP_EQUIPMENT" | "DROP_EQUIPMENT" | "USE_ITEM" | "DESCEND" | "PASS";
  target?: string;
  charged?: boolean;
  microgameScore?: number;
  defenseScore?: number;
};
export type MultiplayerPlayer = {
  id: string;
  roomId: string;
  health: number;
  energy: number;
  item: string | null;
  equipment: string | null;
  classId: GameClassId;
  miracleUsed?: boolean;
  focusTurns?: number;
  focusBoost?: number;
  empoweredAttackTurns?: number;
  empoweredAttackBonus?: number;
  defenseBuff: number;
  defenseBuffTurns: number;
  vanguard: number;
  vanguardSource: string | null;
  nextAttackBonus: number;
  gameplayOptions?: MultiplayerPlayerOptions;
};
export type MultiplayerState = GameState & {
  version: 2;
  seed: string;
  difficulty: Difficulty;
  level: number;
  map: DungeonMap;
  phase: "briefing" | "playing";
  briefingReady: string[];
  players: Record<string, MultiplayerPlayer>;
  turnsLeft: number;
  ended: boolean;
  werewolfAggroPlayerId?: string | null;
  werewolfWitnessPlayerIds?: string[];
};
export function createMultiplayerState(seed: string, difficulty: Difficulty, ids: string[], random: () => number = Math.random): MultiplayerState {
  // Multiplayer starts from one shared level and gives every roster member independent character resources.
  const isGhostTestSeed = seed.trim().toLowerCase() === "testghost";
  const isTestSeed = /^(?:test|testwarrior|testcleric|testthief|testwizard|testranger|testarcher)$/i.test(seed.trim());
  const testClassId = isTestSeed ? gameClassForSeed(seed, random).id : null;
  // Ordinary multiplayer runs roll independently for each player. Reserved test
  // seeds keep their fixture class; testghost deliberately starts its host fallen.
  const classIds = ids.map((_, index) => isGhostTestSeed
    ? index === 0 ? "ghost" : "warrior"
    : testClassId ?? randomGameClass(random).id);
  const map = createLevelMap(seed, 1, undefined, difficulty !== "easy", ids.length);
  if (isGhostTestSeed) configureGhostTestMap(map, ids.length);
  const players = Object.fromEntries(ids.map((id, index) => [id, {
    id,
    roomId: map.startingRoomId,
    health: isGhostTestSeed && index === 0 ? 0 : PLAYER_MAX_HEALTH,
    energy: PLAYER_MAX_ENERGY,
    item: null,
    equipment: null,
    classId: classIds[index],
    miracleUsed: false,
    focusTurns: 0,
    focusBoost: 0,
    empoweredAttackTurns: 0,
    empoweredAttackBonus: 0,
    defenseBuff: 0,
    defenseBuffTurns: 0,
    vanguard: 0,
    vanguardSource: null,
    nextAttackBonus: 0,
  }]));

  return {
    version: 2,
    turn: 0,
    seed,
    difficulty,
    level: 1,
    map,
    ended: false,
    werewolfAggroPlayerId: null,
    werewolfWitnessPlayerIds: [],
    phase: "briefing",
    briefingReady: [],
    turnsLeft: getHardTurnLimit({ difficulty, map }),
    players,
  };
}

function configureGhostTestMap(map: DungeonMap, playerCount: number) {
  // This multiplayer-only fixture starts one player as a ghost so its special rules
  // can be tested without making that state possible in ordinary single-player runs.
  const route = ["A1", "A2", "A3", "A4"];
  const rooms = map.rooms.flat();
  if (route.some(id => !rooms.some(room => room.id === id))) {
    throw new Error("The testghost dungeon needs four adjacent rooms in row A");
  }
  map.startingRoomId = route[0];
  map.entities = { items: {}, equipment: {}, doorwayGuards: {}, monsters: {} };
  for (const room of rooms) {
    room.contents = [];
    room.isCurrentPosition = room.id === route[0];
    room.isRevealed = room.id === route[0];
    room.north = room.east = room.south = room.west = "wall";
  }
  route.slice(0, -1).forEach((roomId, index) => {
    setConnectionBoundary(map.rooms, roomId, "east", index === 0 ? "locked" : index === 1 ? "guarded" : "open");
  });
  const start = rooms.find(room => room.id === route[0])!;
  const zombie = createMonster(0, route[0], () => 0, 1, playerCount);
  zombie.id = "testghost:zombie";
  zombie.currentHealth = 50;
  zombie.damage = 0;
  map.entities.monsters[zombie.id] = zombie;
  start.contents.push({ id: zombie.id, type: "monster" });
  const item = createItem("health-potion", "testghost:item-chest");
  map.entities.items[item.id] = item;
  start.contents.push({ id: item.id, isChest: true, type: "item" });
  const equipment = createEquipment("good-weapon", "testghost:equipment-chest");
  map.entities.equipment[equipment.id] = equipment;
  start.contents.push({ id: equipment.id, isChest: true, type: "equipment" });
  const guard = createMonster(1, "A2:east", () => 0, 1, playerCount);
  guard.id = "testghost:guard";
  placeDoorwayGuard(map, "A2", "east", guard);
  rooms.find(room => room.id === route[3])!.contents.push({ id: "stairs", label: "Stairs", type: "stairs" });
}

function applyPlayerDamage(player: MultiplayerPlayer, damage: number) {
  // Health Potions take priority; Miracle is available once per floor without spending Energy.
  const result = resolveHealthLoss(player.health, damage, player.item);
  if (result.usesPotion) player.item = null;
  const miracle = resolveClericMiracle({
    alreadyUsed: player.miracleUsed ?? false,
    classId: player.classId,
    healthAfterDamage: result.nextHealth,
    usedPotion: result.usesPotion,
  });
  player.health = miracle.health;
  if (miracle.triggered) player.miracleUsed = true;
}

function isTurnBudgeted(player: MultiplayerPlayer, fallbackDifficulty: Difficulty) {
  return (player.gameplayOptions?.difficulty ?? fallbackDifficulty) !== "easy";
}

function hasSharedTurnBudget(state: MultiplayerState) {
  return Object.values(state.players).some(player => isTurnBudgeted(player, state.difficulty));
}

function grantThiefReward(state: MultiplayerState, target: MultiplayerPlayer) {
  // The thief reward fills an empty slot or drops the new item beside the target when full.
  if (Math.random() < 0.5) {
    const item = POSSIBLE_ITEMS[Math.floor(Math.random() * POSSIBLE_ITEMS.length)];
    if (target.item) {
      state.map = addItemToRoom(state.map, target.roomId, item.id);
    } else {
      target.item = item.id;
    }
    return;
  }

  const equipment = POSSIBLE_EQUIPMENT[Math.floor(Math.random() * POSSIBLE_EQUIPMENT.length)];
  if (target.equipment) {
    state.map = addEquipmentToRoom(state.map, target.roomId, equipment.equipmentId);
  } else {
    target.equipment = equipment.equipmentId;
  }
}

/** Stable player order makes contested items/attacks independent of packet arrival order. */
export function resolveMultiplayerTurn(
  previous: MultiplayerState,
  actions: ReadonlyMap<string, PlayerAction>,
): MultiplayerState {
  if (previous.ended) return previous;
  // Clone the mutable player records first so resolving a turn never mutates the previous network snapshot.
  const state: MultiplayerState = {
    ...previous,
    turn: previous.turn + 1,
    players: Object.fromEntries(
      Object.entries(previous.players).map(([id, player]) => [id, { ...player }]),
    ),
  };
  if (state.phase === "briefing") {
    for (const playerId of Object.keys(state.players)) {
      if (actions.get(playerId)?.type === "CLASS_READY" && !state.briefingReady.includes(playerId)) {
        state.briefingReady.push(playerId);
      }
    }
    if (Object.keys(state.players).every(id => state.briefingReady.includes(id))) {
      state.phase = "playing";
    }
    return state;
  }
  const werewolf = getWerewolf(state.map);
  const werewolfRoom = werewolf
    ? state.map.rooms.flat().find(room => room.contents.some(content => content.type === "monster" && content.id === werewolf.id))
    : undefined;
  if (werewolf && werewolfRoom && !state.werewolfAggroPlayerId) {
    const playersWhoSeeWerewolf = Object.values(state.players).filter(player => player.roomId === werewolfRoom.id);
    const playersEnteringWerewolfRoom = playersWhoSeeWerewolf.length ? [] : Object.values(state.players).filter(player => {
      const action = actions.get(player.id);
      if (action?.type !== "MOVE" || !["north", "east", "south", "west"].includes(action.target ?? "")) return false;
      return getConnectedRoomId(state.map, player.roomId, action.target as Direction) === werewolfRoom.id;
    });
    const firstSightings = playersWhoSeeWerewolf.length ? playersWhoSeeWerewolf : playersEnteringWerewolfRoom;
    if (firstSightings.length) {
      state.werewolfAggroPlayerId = firstSightings[Math.floor(Math.random() * firstSightings.length)].id;
      state.werewolfWitnessPlayerIds = firstSightings.map(player => player.id);
    }
  }
  // Resolve class-specific support before player actions so it works regardless of player ID order.
  for (const [id, source] of Object.entries(state.players)) {
    const action = actions.get(id);
    if (action?.type !== "SUPPORT") continue;
    const target = state.players[action.target ?? id];
    if (!source || !target || source.roomId !== target.roomId) continue;
    if (source.health <= 0) {
      target.nextAttackBonus += 5;
      continue;
    }
    if (target.health <= 0) continue;
    const chargeCost = getEquipmentStats(source.equipment).chargeCost;
    const charged = !!action.charged && source.energy >= chargeCost;
    if (charged) {
      const energy = resolveEnergyLoss(source.energy, chargeCost, source.item);
      source.energy = energy.nextEnergy;
      if (energy.usesMeal) source.item = null;
    }
    if (source.classId === "warrior") {
      target.vanguard = 1;
      target.vanguardSource = source.id === target.id ? null : source.id;
      if (charged) {
        source.defenseBuff = Math.max(source.defenseBuff, 5);
        source.defenseBuffTurns = Math.max(source.defenseBuffTurns, 1);
      }
    } else if (source.classId === "cleric") {
      target.defenseBuff = Math.max(target.defenseBuff, 5);
      target.defenseBuffTurns = Math.max(target.defenseBuffTurns, 2);
      if (charged) target.health = Math.min(PLAYER_MAX_HEALTH, target.health + 10);
    } else if (source.classId === "archer") {
      target.focusTurns = Math.max(target.focusTurns ?? 0, 2);
      target.focusBoost = Math.max(target.focusBoost ?? 0, charged ? 3 : 2);
    } else if (source.classId === "wizard") {
      target.empoweredAttackTurns = Math.max(target.empoweredAttackTurns ?? 0, 3);
      target.empoweredAttackBonus = Math.max(target.empoweredAttackBonus ?? 0, charged ? 10 : 5);
    } else if (Math.random() < (charged ? 0.2 : 0.1)) {
      grantThiefReward(state, target);
    }
  }
  // An enemy in a room that someone enters this round gets its first action next round.
  // Precompute all destinations before player actions so roster order cannot make an
  // enemy attack an existing occupant before another player enters that same room.
  const roomsEnteredThisTurn = new Set<string>();
  for (const [id, submittedAction] of actions) {
    const action = submittedAction.type === "PASS" ? null : submittedAction;
    if (!action) continue;
    if (action.type !== "MOVE" || !["north", "east", "south", "west"].includes(action.target ?? "")) continue;
    const mover = state.players[id];
    if (!mover) continue;
    const direction = action.target as Direction;
    const room = getRoom(state.map, mover.roomId);
    const doorway = room[direction];
    if (doorway === "wall" || doorway === "guarded") continue;
    if (doorway === "locked" && mover.health > 0) {
      const hadKey = mover.item === "key";
      const cost = getEquipmentStats(mover.equipment ?? null).chargeCost;
      const charged = !!action.charged && mover.energy >= cost;
      const thiefMustSpendTurnToPick = mover.classId === "thief" && !charged && !hadKey;
      if ((!hadKey && mover.classId !== "thief") || thiefMustSpendTurnToPick) continue;
    }
    const neighbor = getNeighborInGrid(state.map.rooms, room, direction);
    if (neighbor) roomsEnteredThisTurn.add(getRoomId(neighbor));
  }
  for (const player of Object.values(state.players)) {
    // Player iteration follows roster insertion order; that order decides contested pickups deterministically.
    const submittedAction = actions.get(player.id);
    const action = submittedAction?.type === "PASS" ? undefined : submittedAction;
    const room = getRoom(state.map, player.roomId);
    if (player.health <= 0) {
      if (action?.type === "MOVE" && ["north", "east", "south", "west"].includes(action.target ?? "") && room[action.target as Direction] !== "wall") {
        const neighbor = getNeighborInGrid(state.map.rooms, room, action.target as Direction);
        if (neighbor) {
          const destination = getRoom(state.map, getRoomId(neighbor));
          player.roomId = destination.id;
          state.map = moveCurrentPosition(state.map, destination.id);
        }
      } else if (action?.type === "ATTACK") {
        const monster = getTargetableMonsters(state.map, room).find(candidate => candidate.id === action.target);
        if (monster && !monster.chases) {
          const damage = Math.min(monster.currentHealth, 5 + player.nextAttackBonus);
          state.map = damageMonsterInRoom(state.map, player.roomId, monster.id, damage);
          if (damage > 0) player.nextAttackBonus = 0;
        }
      }
      if (player.id === state.werewolfAggroPlayerId && werewolf && werewolf.currentHealth > 0) {
        state.map = moveWerewolfToRoom(state.map, player.roomId);
      }
      // Ghost actions never trigger enemy attacks, curses, item pickups, or energy costs.
      continue;
    }
    if (action?.type === "DROP_EQUIPMENT") {
      if (player.equipment) {
        state.map = addEquipmentToRoom(state.map, player.roomId, player.equipment, false);
        player.equipment = null;
      }
      if (action.charged) {
        player.energy = Math.min(
          PLAYER_MAX_ENERGY,
          player.energy + GAME_PARAMETERS.combat.chargeEnergyCost,
        );
      }
      if (player.id === state.werewolfAggroPlayerId && werewolf && werewolf.currentHealth > 0) {
        state.map = moveWerewolfToRoom(state.map, player.roomId);
      }
      continue;
    }
    if (action?.type === "USE_ITEM") {
      if (player.item === "health-potion" && player.health < PLAYER_MAX_HEALTH) {
        player.health = recoverStat(player.health, PLAYER_MAX_HEALTH);
        player.item = null;
      } else if (player.item === "energy-meal" && player.energy < PLAYER_MAX_ENERGY) {
        player.energy = recoverStat(player.energy, PLAYER_MAX_ENERGY);
        player.item = null;
      } else if (player.item === "clock") {
        // No upper limit: additional clocks can keep extending the run.
        state.turnsLeft += GAME_PARAMETERS.turn.clockBaseTurns + state.level;
        player.item = null;
      }
    }
    const isChargeableAction = !!action && ["ATTACK", "MOVE", "PICKUP", "PICKUP_EQUIPMENT"].includes(action.type);
    const chargeCost = getEquipmentStats(player.equipment ?? null).chargeCost;
    const charged = isChargeableAction && !!action.charged && player.energy >= chargeCost;
    if (charged) {
      const result = resolveEnergyLoss(player.energy, chargeCost, player.item);
      player.energy = result.nextEnergy;
      if (result.usesMeal) player.item = null;
    }
    const isThiefLockPick = action?.type === "MOVE" &&
      player.classId === "thief" && player.item !== "key" &&
      room?.[action.target as Direction] === "locked";
    const isFreeAction = action?.type === "MOVE" || action?.type === "PICKUP" || action?.type === "PICKUP_EQUIPMENT";
    if (charged && isFreeAction && !isThiefLockPick) {
      player.energy = Math.min(PLAYER_MAX_ENERGY, player.energy + chargeCost);
    }
    if (action?.type === "MOVE" && ["north", "east", "south", "west"].includes(action.target ?? "")) {
      const direction = action.target as Direction;
      const wasLocked = room?.[direction] === "locked";
      const hadKey = player.item === "key";
      if (wasLocked && (player.item === "key" || player.classId === "thief")) {
        state.map = unlockDoor(state.map, player.roomId, direction);
        if (player.item === "key") player.item = null;
      }
      const destination = getConnectedRoomId(state.map, player.roomId, direction);
      if (destination) {
        const thiefMustSpendTurnToPick = wasLocked && player.classId === "thief" && !charged && !hadKey;
        if (!thiefMustSpendTurnToPick) {
          player.roomId = destination;
          state.map = moveCurrentPosition(state.map, destination);
          if (player.id === state.werewolfAggroPlayerId && werewolf && werewolf.currentHealth > 0) {
            state.map = moveWerewolfToRoom(state.map, player.roomId);
          }
          continue;
        }
      }
    }
    if (action?.type === "ATTACK") {
      const monster = getTargetableMonsters(state.map, room).find(m => m.id === action.target);
      if (monster) {
        const silver = monster.chases && player.item === "silver-bullet";
        const attackScore = Math.max(0, action.microgameScore ?? 100);
        const damage = silver
          ? monster.currentHealth
          : resolveAttackDamage({
            profile: getPlayerAttackDamage(monster, charged, player.classId) + (player.empoweredAttackBonus ?? 0),
            score: attackScore,
            equipmentAttack: getEquipmentStats(player.equipment).attack,
            charged,
            difficulty: player.gameplayOptions?.difficulty ?? state.difficulty,
            target: monster,
          });
        const damageApplied = Math.min(monster.currentHealth, damage > 0 ? damage + player.nextAttackBonus : 0);
        if (damageApplied > 0) player.nextAttackBonus = 0;
        console.info(`[combat] Player ${player.id} dealt ${damageApplied} damage to ${monster.name}${silver ? " with a Silver Arrow" : monster.chases ? " (immune to ordinary attacks)" : ""}.`);
        state.map = damageMonsterInRoom(
          state.map,
          player.roomId,
          monster.id,
          damageApplied,
        );
        const chainDamage = player.classId === "wizard" ? Math.floor(damageApplied / 2) : 0;
        if (chainDamage > 0) {
          for (const chainTarget of getTargetableMonsters(state.map, room).filter(candidate => candidate.id !== monster.id)) {
            state.map = damageMonsterInRoom(state.map, player.roomId, chainTarget.id, chainDamage);
          }
        }
        if (silver) player.item = null;
      }
    }
    if (action?.type === "PICKUP_EQUIPMENT") {
      const selected = action.target
        ? getRoomEquipmentById(state.map, room, action.target)
        : (() => {
            const held = getRoomEquipment(state.map, room);
            const reference = room.contents.find(content => content.type === "equipment");
            return held && reference ? { equipment: held, reference } : null;
          })();
      if (selected?.reference.isChest && player.equipment) {
        state.map = revealRoomLootChest(state.map, player.roomId, selected.equipment.id, "equipment");
      } else if (selected) {
        state.map = removeEquipmentFromRoom(state.map, player.roomId, selected.equipment.id);
        if (player.equipment) state.map = addEquipmentToRoom(state.map, player.roomId, player.equipment, false);
        player.equipment = selected.equipment.equipmentId;
      }
    }
    if (action?.type === "PICKUP") {
      const selected = action.target
        ? getRoomItemById(state.map, room, action.target)
        : (() => {
            const item = getRoomItem(state.map, room);
            const reference = room.contents.find(content => content.type === "item");
            return item && reference ? { item, reference } : null;
          })();
      if (selected?.reference.isChest && player.item) {
        state.map = revealRoomLootChest(state.map, player.roomId, selected.item.id, "item");
      } else if (selected) {
        // Remove the instance ID, not the item's kind (there can be several of a kind).
        state.map = { ...state.map, rooms: state.map.rooms.map(row => row.map(r => r.id === player.roomId
          ? { ...r, contents: r.contents.filter(c => !(c.type === "item" && c.id === selected.item.id)) } : r)) };
        if (player.item) state.map = addItemToRoom(state.map, player.roomId, player.item, false);
        player.item = selected.item.itemId ?? selected.item.id;
      }
    }
    // The Werewolf follows its first-seen player after that player's action, including support.
    if (player.id === state.werewolfAggroPlayerId && werewolf && werewolf.currentHealth > 0) {
      state.map = moveWerewolfToRoom(state.map, player.roomId);
    }
    const enemy = getRoomMonster(state.map, getRoom(state.map, player.roomId));
    // An absent action represents a player who let the turn timer expire. Do not
    // resolve a hit against them: they had no opportunity to start the local
    // defense microgame that supplies their defense score.
    if (action && enemy && !roomsEnteredThisTurn.has(player.roomId)) {
      const protector = player.vanguardSource ? state.players[player.vanguardSource] : null;
      const recipient = protector && protector.health > 0 && protector.roomId === player.roomId ? protector : player;
      const recipientClassDefense = recipient.classId === "warrior" ? 15 : GAME_PARAMETERS.player.defense;
      const armoredDamage = applyDefense(
        enemy.damage,
        recipientClassDefense +
          getEquipmentStats(recipient.equipment).defense +
          recipient.defenseBuff,
      );
      const defenseScore = Math.max(0, Math.min(100, scaleDefenseMicrogameScore(actions.get(recipient.id)?.defenseScore ?? 0, recipient.gameplayOptions?.difficulty ?? state.difficulty)));
      const incomingDamage = Math.ceil(armoredDamage * (100 - Math.max(0, Math.min(100, defenseScore))) / 100);
      console.info(
        `[combat] ${enemy.name} dealt ${incomingDamage} damage to Player ${recipient.id} (${incomingDamage === 0 ? "blocked" : `base ${enemy.damage}, reduced by ${enemy.damage - incomingDamage} defense`}).`,
      );
      applyPlayerDamage(recipient, incomingDamage);
      if (player.vanguard > 0) {
        const reflectedDamage = getWarriorRiposteDamage(enemy, GAME_PARAMETERS.combat.warriorRiposteDamage);
        console.info(`[combat] Player ${player.id} reflected ${reflectedDamage} damage to ${enemy.name}.`);
        state.map = damageMonsterInRoom(
          state.map,
          player.roomId,
          enemy.id,
          reflectedDamage,
        );
        player.vanguard = 0;
      }
      player.vanguardSource = null;
    }
  }
  for (const player of Object.values(state.players)) {
    if (player.defenseBuffTurns > 0) {
      player.defenseBuffTurns -= 1;
      if (player.defenseBuffTurns === 0) player.defenseBuff = 0;
    }
    if ((player.focusTurns ?? 0) > 0) {
      player.focusTurns = (player.focusTurns ?? 0) - 1;
      if (player.focusTurns === 0) player.focusBoost = 0;
    }
    if ((player.empoweredAttackTurns ?? 0) > 0) {
      player.empoweredAttackTurns = (player.empoweredAttackTurns ?? 0) - 1;
      if (player.empoweredAttackTurns === 0) player.empoweredAttackBonus = 0;
    }
    if (player.health <= 0) continue;
    const curseDamage = getEquipmentStats(player.equipment ?? null).turnDamage;
    if (curseDamage <= 0) continue;
    applyPlayerDamage(player, curseDamage);
  }
  let alive = Object.values(state.players).filter(p => p.health > 0);
  if (!getWerewolf(state.map)) {
    state.werewolfAggroPlayerId = null;
    state.werewolfWitnessPlayerIds = [];
  } else if (state.werewolfAggroPlayerId && state.players[state.werewolfAggroPlayerId]?.health <= 0) {
    const deceasedTargetId = state.werewolfAggroPlayerId;
    const otherWitnesses = (state.werewolfWitnessPlayerIds ?? [])
      .filter(id => id !== deceasedTargetId && state.players[id]?.health > 0);
    const candidates = otherWitnesses.length
      ? otherWitnesses
      : alive.filter(player => player.id !== deceasedTargetId).map(player => player.id);
    state.werewolfAggroPlayerId = candidates.length
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : null;
  }
  // Everyone alive must reach the stairs; one player then chooses Descend.
  if (alive.length && alive.every(p => hasRoomStairs(getRoom(state.map, p.roomId))) &&
      alive.some(p => actions.get(p.id)?.type === "DESCEND")) {
    state.level++;
    state.map = createLevelMap(state.seed, state.level, undefined, state.difficulty !== "easy", Object.keys(state.players).length);
    state.turnsLeft = getHardTurnLimit({ difficulty: hasSharedTurnBudget(state) ? "normal" : "easy", map: state.map });
    for (const player of Object.values(state.players)) {
      player.roomId = state.map.startingRoomId; player.health = PLAYER_MAX_HEALTH; player.energy = PLAYER_MAX_ENERGY;
      player.miracleUsed = false;
      player.focusTurns = 0;
      player.focusBoost = 0;
      player.empoweredAttackTurns = 0;
      player.empoweredAttackBonus = 0;
    }
    state.werewolfAggroPlayerId = null;
    state.werewolfWitnessPlayerIds = [];
  } else if (hasSharedTurnBudget(state)) {
    const clockOwner = alive.find(p => p.item === "clock");
    const result = resolveTurnLoss(state.turnsLeft, clockOwner?.item ?? null, state.level);
    state.turnsLeft = result.nextCounter;
    if (result.usesClock && clockOwner) clockOwner.item = null;
    if (state.turnsLeft <= 0) {
      for (const player of Object.values(state.players)) {
        if (player.health > 0 && isTurnBudgeted(player, state.difficulty)) player.health = 0;
      }
      alive = Object.values(state.players).filter(player => player.health > 0);
    }
  }
  // Keep items and equipment available to the remaining party when a player
  // crosses into ghost state, including when their shared turn budget expires.
  for (const [id, player] of Object.entries(state.players)) {
    if (previous.players[id].health <= 0 || player.health > 0) continue;
    if (player.item) {
      state.map = addItemToRoom(state.map, player.roomId, player.item, false);
      player.item = null;
    }
    if (player.equipment) {
      state.map = addEquipmentToRoom(state.map, player.roomId, player.equipment, false);
      player.equipment = null;
    }
  }
  state.ended = alive.length === 0;
  return state;
}

export function isMultiplayerState(value: GameState): value is MultiplayerState {
  // Check the minimum versioned shape before accepting a snapshot from another device.
  const state = value as MultiplayerState;
  const validPlayer = (player: MultiplayerPlayer) =>
    typeof player.id === "string" &&
    typeof player.roomId === "string" &&
    Number.isFinite(player.health) &&
    Number.isFinite(player.energy) &&
    (player.item === null || typeof player.item === "string") &&
    (player.equipment === null || typeof player.equipment === "string") &&
    (player.miracleUsed === undefined || typeof player.miracleUsed === "boolean") &&
    (player.focusTurns === undefined || Number.isFinite(player.focusTurns)) &&
    (player.focusBoost === undefined || Number.isFinite(player.focusBoost)) &&
    (player.empoweredAttackTurns === undefined || Number.isFinite(player.empoweredAttackTurns)) &&
    (player.empoweredAttackBonus === undefined || Number.isFinite(player.empoweredAttackBonus)) &&
    ["warrior", "cleric", "thief", "archer", "wizard", "ghost"].includes(player.classId) &&
    Number.isFinite(player.defenseBuff) &&
    Number.isFinite(player.vanguard) &&
    Number.isFinite(player.nextAttackBonus) &&
    (player.vanguardSource === null || typeof player.vanguardSource === "string");

  return state.version === 2 &&
    typeof state.seed === "string" &&
    ["easy", "normal", "hard"].includes(state.difficulty) &&
    Number.isInteger(state.level) && state.level > 0 &&
    typeof state.ended === "boolean" &&
    (state.werewolfAggroPlayerId === undefined || state.werewolfAggroPlayerId === null || typeof state.werewolfAggroPlayerId === "string") &&
    (state.werewolfWitnessPlayerIds === undefined || (Array.isArray(state.werewolfWitnessPlayerIds) && state.werewolfWitnessPlayerIds.every(id => typeof id === "string"))) &&
    Number.isFinite(state.turnsLeft) &&
    (state.phase === "briefing" || state.phase === "playing") &&
    Array.isArray(state.briefingReady) &&
    state.briefingReady.every(id => typeof id === "string") &&
    !!state.map && Array.isArray(state.map.rooms) && !!state.map.entities &&
    !!state.players && Object.values(state.players).every(player => validPlayer(player) && (player.gameplayOptions === undefined || isMultiplayerPlayerOptions(player.gameplayOptions)));
}

