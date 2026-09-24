import AsyncStorage from "@react-native-async-storage/async-storage";

import { createSeededDungeonMap } from "@/utils/dungeon-generation";
import type { DungeonMap, GridPosition } from "@/utils/dungeon-map";

const MAP_STORAGE_KEY = "project-1:dungeon-map";

function getBrowserStorage(): Storage | null {
  return typeof globalThis.window?.localStorage === "undefined"
    ? null
    : globalThis.window.localStorage;
}

export async function saveDungeonMap(map: DungeonMap) {
  const serialized = JSON.stringify(map);
  const browserStorage = getBrowserStorage();
  if (browserStorage) {
    browserStorage.setItem(MAP_STORAGE_KEY, serialized);
  } else {
    await AsyncStorage.setItem(MAP_STORAGE_KEY, serialized);
  }
}

export async function loadDungeonMap() {
  const browserStorage = getBrowserStorage();
  const storedMap = browserStorage
    ? browserStorage.getItem(MAP_STORAGE_KEY)
    : await AsyncStorage.getItem(MAP_STORAGE_KEY);
  return storedMap ? (JSON.parse(storedMap) as DungeonMap) : null;
}

export async function createAndSaveSeededDungeonMap(seed: string, level: number, startingPosition?: GridPosition, includeClock = false) {
  const map = createSeededDungeonMap(seed, level, startingPosition, includeClock);
  await saveDungeonMap(map);
  return map;
}

export async function updateStoredDungeonMap(updater: (map: DungeonMap) => DungeonMap) {
  const map = await loadDungeonMap();
  if (!map) return null;
  const nextMap = updater(map);
  await saveDungeonMap(nextMap);
  return nextMap;
}
