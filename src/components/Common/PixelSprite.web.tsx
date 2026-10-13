import { useState } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";

const monsters = require("../../../assets/32rogues/monsters.png");
const tiles = require("../../../assets/32rogues/tiles.png");
const rogues = require("../../../assets/32rogues/rogues.png");
const items = require("../../../assets/32rogues/items.png");
type Tile = { source: { uri?: string; src?: string }; width: number; height: number; row: number; column: number };
const monster = (row: number, column: number): Tile => ({ source: monsters, width: 384, height: 416, row, column });
const item = (row: number, column: number): Tile => ({ source: items, width: 352, height: 832, row, column });
const sprites: Record<string, Tile> = {
  "stone-floor": { source: tiles, width: 544, height: 832, row: 6, column: 1 },
  warrior_graphic: { source: rogues, width: 224, height: 224, row: 1, column: 0 },
  cleric_graphic: { source: rogues, width: 224, height: 224, row: 2, column: 2 },
  thief_graphic: { source: rogues, width: 224, height: 224, row: 0, column: 3 },
  pixel_golem_graphic: monster(7, 2), zombie_graphic: monster(4, 4), dragon_graphic: monster(8, 2),
  vampire_graphic: monster(3, 1), werewolf_graphic: monster(6, 5), health_potion_graphic: item(19, 1),
  key_graphic: item(22, 0), good_armor_graphic: item(12, 3), good_weapon_graphic: item(0, 3),
  heavy_armor_graphic: item(12, 5), heavy_weapon_graphic: item(3, 3), amulet_graphic: item(16, 0), lock_graphic: item(22, 0),
};

export function PixelSprite({ sprite, label, size = 32, style }: { sprite: string; label: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const [failed, setFailed] = useState(false);
  const tile = sprites[sprite];
  if (!tile || failed) return <View style={[{ minWidth: size }, style]}><Text accessibilityLabel={label} accessibilityRole="image" allowFontScaling={false} style={{ fontSize: Math.max(7, size * 0.24), lineHeight: Math.max(9, size * 0.3), textAlign: "center" }}>[{sprite}]</Text></View>;
  const uri = tile.source.uri ?? tile.source.src;
  if (!uri) return <View style={[{ minWidth: size }, style]}><Text accessibilityLabel={label} accessibilityRole="image">[{sprite}]</Text></View>;
  const scale = size / 32;
  return <View accessibilityLabel={label} accessibilityRole="image" style={[{ width: size, height: size, overflow: "hidden" }, style]}>
    <View testID="pixel-sprite-image" data-sprite={sprite} style={{ position: "absolute", width: size, height: size,
      backgroundImage: `url("${uri}")`, backgroundRepeat: "no-repeat", backgroundSize: `${tile.width * scale}px ${tile.height * scale}px`,
      backgroundPosition: `${-tile.column * size}px ${-tile.row * size}px`, imageRendering: "pixelated" } as unknown as ViewStyle} />
  </View>;
}
