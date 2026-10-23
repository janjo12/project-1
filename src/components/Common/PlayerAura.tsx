import { View } from "react-native";

export function PlayerAura({ color, size = 62 }: { color: string; size?: number }) {
  const offset = size / 2;
  return <View pointerEvents="none" style={{
    position: "absolute",
    left: "50%",
    top: "50%",
    width: size,
    height: size,
    borderRadius: offset,
    borderWidth: 3,
    borderColor: color,
    backgroundColor: color,
    opacity: 0.28,
    transform: [{ translateX: -offset }, { translateY: -offset }],
  }} />;
}
