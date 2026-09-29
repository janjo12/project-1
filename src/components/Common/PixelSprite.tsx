import { Image } from "expo-image";
import { Text, View } from "react-native";

type Tile = { source: number; width: number; height: number; row: number; column: number };
const monsters = require("../../assets/32rogues/monsters.png");
const tiles = require("../../assets/32rogues/tiles.png");
const rogues = require("../../assets/32rogues/rogues.png");
const items = require("../../assets/32rogues/items.png");
const monster = (row: number, column: number): Tile => ({ source: monsters, width: 384, height: 416, row, column });
const item = (row: number, column: number): Tile => ({ source: items, width: 352, height: 832, row, column });
// Atlas coordinates follow the pack's accompanying row / letter indexes.
const sprites: Record<string, Tile> = {
  "stone-floor": { source: tiles, width: 544, height: 832, row: 6, column: 1 },
  "🤺": { source: rogues, width: 224, height: 224, row: 1, column: 0 },
  "👾": monster(7, 2), "🧟": monster(4, 4), "🐉": monster(8, 2),
  "🧛": monster(3, 1), "🐺": monster(6, 5),
  "🍔": item(25, 1), "🧪": item(19, 1), "🗝️": item(22, 0),
};

export function PixelSprite({ sprite, label, size = 32 }: { sprite: string; label: string; size?: number }) {
  const tile = sprites[sprite];
  if (!tile) return <Text accessibilityLabel={label} allowFontScaling={false} style={{ fontSize: size, lineHeight: size + 6 }}>{sprite}</Text>;
  const scale = size / 32;
  return (
    <View accessibilityLabel={label} accessibilityRole="image" style={{ width: size, height: size, overflow: "hidden" }}>
      <Image source={tile.source} contentFit="fill" transition={0} style={{
        position: "absolute", width: tile.width * scale, height: tile.height * scale,
        left: -tile.column * size, top: -tile.row * size,
      }} />
    </View>
  );
}
