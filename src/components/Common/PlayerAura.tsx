import { Animated, Platform, Text, View } from "react-native";
import { useEffect, useState } from "react";

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

export function SupportFeedback({ emoji, label }: { emoji: string; label: string }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: 1000, useNativeDriver: Platform.OS !== "web" });
    animation.start();
    return () => animation.stop();
  }, [progress]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1.7, 0.55] });
  const opacity = progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 0.9, 0] });
  return (
    <Animated.View pointerEvents="none" style={{
      alignItems: "center",
      backgroundColor: "rgba(15, 23, 42, 0.82)",
      borderColor: "#fbbf24",
      borderRadius: 28,
      borderWidth: 2,
      justifyContent: "center",
      left: "50%",
      opacity,
      paddingHorizontal: 9,
      paddingVertical: 4,
      position: "absolute",
      top: "50%",
      transform: [{ translateX: -27 }, { translateY: -28 }, { scale }],
      zIndex: 20,
    }} testID="support-feedback">
      <Text style={{ fontSize: 30, lineHeight: 34 }}>{emoji}</Text>
      <Text style={{ color: "#fde68a", fontSize: 10, fontWeight: "900", lineHeight: 12 }}>{label}</Text>
    </Animated.View>
  );
}
