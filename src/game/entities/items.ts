import { GAME_PARAMETERS } from "@/game/config/gameparameters";

export type ItemId = string;
export type EquipmentId = string;

export type WorldItem = {
  description?: string;
  id: ItemId;
  itemId?: ItemId;
  sprite?: string;
  label: string;
  type: "item";
};

export type EquipmentCatalogEntry = {
  id: string;
  label: string;
  description: string;
  sprite: string;
  attack: number;
  defense: number;
  chargeCost?: number;
  turnDamage?: number;
  hiddenDescription?: boolean;
};

export type WorldEquipment = {
  id: EquipmentId;
  equipmentId: EquipmentId;
  label: string;
  sprite: string;
  type: "equipment";
};

export const POSSIBLE_ITEMS: WorldItem[] = GAME_PARAMETERS.items.map((item) => ({
  ...item,
  type: "item" as const,
}));

export const POSSIBLE_EQUIPMENT: WorldEquipment[] =
  (GAME_PARAMETERS as unknown as { equipment: EquipmentCatalogEntry[] }).equipment.map((equipment) => ({
    ...equipment,
    equipmentId: equipment.id,
    type: "equipment" as const,
  }));

export function createItem(itemId: ItemId, id: string): WorldItem {
  // Keep a per-instance ID separate from the item kind so duplicate items can coexist on a floor.
  const baseItem = POSSIBLE_ITEMS.find((item) => item.id === itemId)!;
  return { ...baseItem, id, itemId };
}

export function createEquipment(equipmentId: EquipmentId, id: string): WorldEquipment {
  // Reject misspelled catalog IDs instead of silently creating unusable equipment.
  const base = POSSIBLE_EQUIPMENT.find((equipment) => equipment.equipmentId === equipmentId);
  if (!base) throw new Error(`Unknown equipment: ${equipmentId}`);
  return { ...base, id };
}
