import type { ItemId } from "@/utils/dungeon-map";

export type ItemDefinition = {
  label: string;
};

export const ITEMS: Record<ItemId, ItemDefinition> = {
  "energy-meal": {
    label: "Energy Meal",
  },
  "health-potion": {
    label: "Health Potion",
  },
  key: {
    label: "Key",
  },
  "silver-bullet": {
    label: "Silver Bullet",
  },
};
