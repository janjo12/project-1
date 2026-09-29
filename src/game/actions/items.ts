import { type Dispatch, type SetStateAction } from "react";

import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH } from "@/game/state/types";
import { getLockedDirections } from "@/game/dungeon/rooms";
import { POSSIBLE_ITEMS, type DungeonMap, type ItemId, type WorldMonster, type EquipmentCatalogEntry } from "@/game/dungeon/types";
import { applyDefense } from "@/game/engine/combat";

const EQUIPMENT: EquipmentCatalogEntry[] = (GAME_PARAMETERS as unknown as { equipment: EquipmentCatalogEntry[] }).equipment;

export function getItemLabel(itemId: ItemId | null) {
  return itemId ? (POSSIBLE_ITEMS.find((item) => item.id === itemId)?.description ?? POSSIBLE_ITEMS.find((item) => item.id === itemId)?.label ?? itemId) : null;
}

export function getEquipmentStats(id: string | null) {
  // Missing gear uses neutral modifiers and the default charge price.
  const equipment = EQUIPMENT.find(item => item.id === id);
  return { attack: equipment?.attack ?? 0, defense: equipment?.defense ?? 0, chargeCost: equipment?.chargeCost ?? GAME_PARAMETERS.combat.chargeEnergyCost, turnDamage: equipment?.turnDamage ?? 0 };
}
export function getEquipmentLabel(id: string | null) { return id ? EQUIPMENT.find(item => item.id === id)?.label ?? id : null; }
export function getEquipmentGroundLabel(id: string) {
  const equipment = EQUIPMENT.find(item => item.id === id);
  return equipment?.hiddenDescription ? "Amulet" : equipment?.label ?? id;
}
export function getEquipmentDescription(id: string | null, revealStats = true) {
  if (!id) return null;
  const item = EQUIPMENT.find(equipment => equipment.id === id);
  if (!item) return id;
  if (!revealStats && item.hiddenDescription) return "Amulet";
  const modifiers = [item.attack ? `Attack ${item.attack > 0 ? "+" : ""}${item.attack}` : "", item.defense ? `Defense ${item.defense > 0 ? "+" : ""}${item.defense}` : "", item.chargeCost ? `Charge Up costs ${item.chargeCost} Energy` : "", item.turnDamage ? `Take ${item.turnDamage} damage each turn` : ""].filter(Boolean);
  return `${item.description}${modifiers.length ? ` · ${modifiers.join(" · ")}` : ""}`;
}

export function getInventoryItemActivationDescription(itemId: ItemId | null) {
  const descriptions: Record<string, string> = {
    clock: "Activates before a turn-limit game over and adds 5 + current level turns.",
    "energy-meal": "Activates when your energy reaches zero.",
    "health-potion": "Activates before you die when your health reaches zero.",
    key: "Activates when you try to open a locked door.",
    "silver-bullet": "Activates when you attack a werewolf, replacing your attack skill.",
  };
  return itemId ? descriptions[itemId] ?? "Activates automatically when needed." : null;
}

export function getInventoryItemSprite(itemId: ItemId | null) {
  return itemId ? (POSSIBLE_ITEMS.find((item) => item.id === itemId)?.sprite ?? null) : null;
}

export function canUseInventoryItem({
  currentRoomId, dungeonMap, inventoryItem, monster, playerEnergy, playerHealth,
}: {
  currentRoomId: string; dungeonMap: DungeonMap; inventoryItem: ItemId | null;
  monster: WorldMonster | null; playerEnergy: number; playerHealth: number;
}) {
  // Items activate only when their trigger applies; keys and silver bullets depend on the current room.
  if (!inventoryItem) return false;
  if (inventoryItem === "health-potion") return playerHealth < PLAYER_MAX_HEALTH;
  if (inventoryItem === "energy-meal") return playerEnergy < PLAYER_MAX_ENERGY;
  if (inventoryItem === "key") return getLockedDirections(dungeonMap, currentRoomId).length > 0;
  return Boolean(monster?.chases);
}

export function resolveHealthLoss(health: number, damage: number, item: ItemId | null) {
  // A potion is consumed only on lethal damage and restores the configured fraction of maximum health.
  const remainingHealth = Math.max(0, health - damage);
  const usesPotion = remainingHealth === 0 && item === "health-potion";
  return { nextHealth: usesPotion ? recoverStat(remainingHealth, PLAYER_MAX_HEALTH) : remainingHealth, usesPotion };
}

export { applyDefense };

export function resolveEnergyLoss(energy: number, cost: number, item: ItemId | null) {
  // Meals follow the same lethal-threshold rule as potions, but for energy expenditure.
  const remainingEnergy = Math.max(0, energy - cost);
  const usesMeal = remainingEnergy === 0 && item === "energy-meal";
  return { nextEnergy: usesMeal ? recoverStat(remainingEnergy, PLAYER_MAX_ENERGY) : remainingEnergy, usesMeal };
}

export function recoverStat(current: number, maximum: number) {
  return Math.min(maximum, current + maximum * GAME_PARAMETERS.player.itemRecoveryFraction);
}

export function resetRoomFeedback({
  setEnemyHealthLossAmount, setPlayerEnergyLossAmount, setPlayerHealthLossAmount,
}: {
  setEnemyHealthLossAmount: Dispatch<SetStateAction<number>>;
  setPlayerEnergyLossAmount: Dispatch<SetStateAction<number>>;
  setPlayerHealthLossAmount: Dispatch<SetStateAction<number>>;
}) {
  setEnemyHealthLossAmount(0);
  setPlayerEnergyLossAmount(0);
  setPlayerHealthLossAmount(0);
}
