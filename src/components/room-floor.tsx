import { PixelSprite } from "@/components/pixel-sprite";
import { SCENE_HEIGHT, SCENE_WIDTH, SPRITE_SIZE } from "@/utils/room-scene-layout";
import { View } from "react-native";

/** Reusable 32px stone tile layer in logical scene coordinates. */
export function RoomFloor() {
  const columns = Math.ceil(SCENE_WIDTH / SPRITE_SIZE);
  const rows = Math.ceil(SCENE_HEIGHT / SPRITE_SIZE);
  return (
    <View testID="tiled-room-floor" style={{ width: SCENE_WIDTH, height: SCENE_HEIGHT, overflow: "hidden" }}>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={{ height: SPRITE_SIZE, flexDirection: "row", opacity: 0.52 }}>
          {Array.from({ length: columns }, (_, column) => (
            <PixelSprite key={`${row}:${column}`} sprite="stone-floor" label="" />
          ))}
        </View>
      ))}
    </View>
  );
}
