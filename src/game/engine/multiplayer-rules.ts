import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { createLevelMap } from "@/game/engine/run-game-level";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/game/state/types";
import { getHardTurnLimit, hasTurnLimit, resolveTurnLoss } from "@/game/engine/resolveTurn";
import { getNeighborInGrid, getRoomId, POSSIBLE_EQUIPMENT, POSSIBLE_ITEMS, type Direction, type DungeonMap } from "@/game/dungeon/types";
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
import { gameClassForSeed, type GameClassId } from "@/game/config/game-classes";
import { getPlayerAttackDamage, resolveAttackDamage, scaleMicrogameScore } from "@/game/engine/combat";
import type { Difficulty } from "@/utils/settings-storage";

export type GameState = { turn: number; [key: string]: unknown };
export type PlayerAction = {
  type: "MOVE" | "ATTACK" | "SUPPORT" | "CLASS_READY" | "PICKUP" | "PICKUP_EQUIPMENT" | "DROP_EQUIPMENT" | "USE_ITEM" | "DESCEND";
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
export function createMultiplayerState(seed: string, difficulty: Difficulty, ids: string[]): MultiplayerState {
  // Multiplayer starts from one shared level and gives every roster member independent character resources.
  const map = createLevelMap(seed, 1, undefined, difficulty !== "easy", ids.length);
  const classId = gameClassForSeed(seed).id;
  const players = Object.fromEntries(ids.map(id => [id, {
    id,
    roomId: map.startingRoomId,
    health: PLAYER_MAX_HEALTH,
    energy: PLAYER_MAX_ENERGY,
    item: null,
    equipment: null,
    classId,
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
  // Clone the mutable player records first so resolving a turn never mutates the previous network snapshot.
  const state: MultiplayerState = {
    ...previous,
    turn: previous.turn + 1,
    players: Object.fromEntries(
      Object.entries(previous.players).map(([id, player]) => [id, { ...player }]),
    ),
  };
  if (state.ended) return state;
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
  for (const player of Object.values(state.players)) {
    // Player iteration follows roster insertion order; that order decides contested pickups deterministically.
    const action = actions.get(player.id);
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
            difficulty: state.difficulty,
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
    if (enemy) {
      const protector = player.vanguardSource ? state.players[player.vanguardSource] : null;
      const recipient = protector && protector.health > 0 && protector.roomId === player.roomId ? protector : player;
      const recipientClassDefense = recipient.classId === "warrior" ? 15 : GAME_PARAMETERS.player.defense;
      const armoredDamage = applyDefense(
        enemy.damage,
        recipientClassDefense +
          getEquipmentStats(recipient.equipment).defense +
          recipient.defenseBuff,
      );
      const defenseScore = Math.max(0, Math.min(100, scaleMicrogameScore(actions.get(recipient.id)?.defenseScore ?? 0, state.difficulty)));
      const incomingDamage = Math.ceil(armoredDamage * (100 - Math.max(0, Math.min(100, defenseScore))) / 100);
      console.info(
        `[combat] ${enemy.name} dealt ${incomingDamage} damage to Player ${recipient.id} (${incomingDamage === 0 ? "blocked" : `base ${enemy.damage}, reduced by ${enemy.damage - incomingDamage} defense`}).`,
      );
      applyPlayerDamage(recipient, incomingDamage);
      if (player.vanguard > 0) {
        const reflectedDamage = Math.min(
          enemy.currentHealth,
          GAME_PARAMETERS.combat.warriorRiposteDamage,
        );
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
  const alive = Object.values(state.players).filter(p => p.health > 0);
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
    state.turnsLeft = getHardTurnLimit({ difficulty: state.difficulty, map: state.map });
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
  } else if (hasTurnLimit(state.difficulty)) {
    const clockOwner = alive.find(p => p.item === "clock");
    const result = resolveTurnLoss(state.turnsLeft, clockOwner?.item ?? null, state.level);
    state.turnsLeft = result.nextCounter;
    if (result.usesClock && clockOwner) clockOwner.item = null;
  }
  state.ended = alive.length === 0 || (hasTurnLimit(state.difficulty) && state.turnsLeft <= 0);
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
    ["warrior", "cleric", "thief", "archer", "wizard"].includes(player.classId) &&
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
    !!state.players && Object.values(state.players).every(validPlayer);
}

