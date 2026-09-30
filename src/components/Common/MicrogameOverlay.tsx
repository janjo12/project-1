import { Pressable, Text, View } from "react-native";
import { useState } from "react";

import { useThemeColors } from "@/components/Common/theme";
import { MicrogameCircle, MicrogameCircleOutline } from "@/components/Common/MicrogameCircle";
import { MICROGAME_MAX_DURATION_MS, type MicrogameKind } from "@/game/actions/use-microgame";

type MicrogameOverlayProps = {
  visible: boolean;
  kind: MicrogameKind;
  elapsed: number;
  targetDelay: number;
  targetSpot: number;
  clicks: number;
  leftHanded: boolean;
  istest?: boolean;
  onTap: () => void;
};

export function MicrogameOverlay({
  visible,
  kind,
  elapsed,
  targetDelay,
  targetSpot,
  clicks,
  leftHanded,
  istest = false,
  onTap,
}: MicrogameOverlayProps) {
  const colors = useThemeColors();
  const [trackWidth, setTrackWidth] = useState(0);

  if (!visible) return null;

  const isConcentration = kind === "concentration";
  const isTimedAttack = kind === "timed-attack";
  const isMultitap = kind === "multitap";
  const progress = Math.max(0, Math.min(1, elapsed / MICROGAME_MAX_DURATION_MS));
  // Match the score calculation's 10–90% track bounds when positioning the moving target.
  const movingSpot = leftHanded ? 0.1 + 0.8 * progress : 0.9 - 0.8 * progress;
  const remainingSeconds = Math.max(0, (MICROGAME_MAX_DURATION_MS - elapsed) / 1000);
  const showNow = isTimedAttack && elapsed >= targetDelay;

  return (
    <View
      testID="microgame-overlay"
      style={{
        position: "absolute",
        zIndex: 100,
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.paper,
        padding: 24,
      }}
    >
      {!isMultitap ? (
        <Pressable
          onPress={onTap}
          accessibilityRole="button"
          accessibilityLabel={isConcentration ? "Tap when the filled circle fills the outline" : "Tap the game screen"}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />
      ) : null}

      {istest ? (
        <Text accessibilityLabel="Test mode" style={{ position: "absolute", top: 8, right: 8, color: colors.fadedInk, fontSize: 10 }}>
          TEST
        </Text>
      ) : null}

      <Text pointerEvents="none" style={{ color: colors.ink, fontSize: 24, fontWeight: "900", textAlign: "center" }}>
        {isConcentration ? "Tap when ● fills ○" : isTimedAttack ? "Tap…" : "Tap the ●"}
      </Text>
      <Text pointerEvents="none" style={{ color: colors.ink, fontSize: 15, marginVertical: 12 }}>
        {isTimedAttack ? "Tap 250 ms after NOW!" : isConcentration ? "One tap only" : `Taps: ${clicks} / 10`}
      </Text>
      {showNow ? (
        <Text pointerEvents="none" style={{ color: colors.accent, fontSize: 56, fontWeight: "900" }}>
          NOW!
        </Text>
      ) : null}

      <Pressable
        onPress={isMultitap ? undefined : onTap}
        accessibilityRole={isMultitap ? undefined : "button"}
        accessibilityLabel={isConcentration ? "Tap game screen" : undefined}
        onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
        style={{ width: "100%", height: 110, position: "relative", marginTop: 24, justifyContent: "center" }}
      >
        {isConcentration ? (
          <MicrogameCircleOutline
            pointerEvents="none"
            size={40}
            style={{ position: "absolute", left: targetSpot * trackWidth - 20 }}
          />
        ) : null}
        {isConcentration ? (
          <MicrogameCircle
            pointerEvents="none"
            size={44}
            style={{ position: "absolute", left: movingSpot * trackWidth - 22 }}
          />
        ) : null}
        {isMultitap ? (
          <Pressable
            onPress={onTap}
            accessibilityRole="button"
            accessibilityLabel="Tap circle"
            style={{ position: "absolute", left: targetSpot * trackWidth - 22 }}
          >
            <MicrogameCircle size={44} />
          </Pressable>
        ) : null}
      </Pressable>

      <Text pointerEvents="none" style={{ color: colors.sepia, fontSize: 13, marginTop: 12 }}>
        Time remaining: {remainingSeconds.toFixed(2)}s
      </Text>
    </View>
  );
}
