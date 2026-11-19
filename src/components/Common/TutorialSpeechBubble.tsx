import { useMemo } from "react";
import { Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { getIdleBobStyle } from "@/components/Common/idleBob";

export function TutorialSpeechBubble({ label, testID, reducedMotion = false, animationsPaused = false }: { label: string; testID?: string; reducedMotion?: boolean; animationsPaused?: boolean }) {
  const bobStyle = useMemo(() => getIdleBobStyle(animationsPaused, reducedMotion), [animationsPaused, reducedMotion]);
  return (
    <Animated.View pointerEvents="none" testID={testID} style={[{ alignItems: "center", zIndex: 10 }, bobStyle]}>
      <View style={{ backgroundColor: "#ffffff", borderColor: "#111827", borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 }}>
        <Text style={{ color: "#111827", fontSize: 10, fontWeight: "900", lineHeight: 13, textAlign: "center" }}>{label}</Text>
      </View>
      <View testID="tutorial-speech-bubble-tail" style={{ borderLeftColor: "transparent", borderLeftWidth: 7, borderRightColor: "transparent", borderRightWidth: 7, borderTopColor: "#111827", borderTopWidth: 8, height: 0, marginTop: -1, width: 0 }}>
        <View style={{ borderLeftColor: "transparent", borderLeftWidth: 6, borderRightColor: "transparent", borderRightWidth: 6, borderTopColor: "#ffffff", borderTopWidth: 7, height: 0, left: -6, position: "absolute", top: -8, width: 0 }} />
      </View>
    </Animated.View>
  );
}
