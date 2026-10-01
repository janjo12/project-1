import { useState, useSyncExternalStore } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";

import { MicrogameCircle, MicrogameCircleOutline } from "@/components/Common/MicrogameCircle";
import { useThemeColors } from "@/components/Common/theme";
import { MICROGAME_MAX_DURATION_MS, type MicrogameKind } from "@/game/actions/use-microgame";
import type { NumberStore } from "@/game/state/numberStore";

type MicrogameOverlayProps = {
  visible: boolean;
  kind: MicrogameKind;
  elapsedStore: NumberStore;
  targetDelay: number;
  targetSpot: number;
  leftHanded: boolean;
  isTest?: boolean;
  onTap: () => void;
};

export function MicrogameOverlay({
  visible,
  kind,
  elapsedStore,
  targetDelay,
  targetSpot,
  leftHanded,
  isTest = false,
  onTap,
}: MicrogameOverlayProps) {
  const colors = useThemeColors();
  const { height } = useWindowDimensions();
  const elapsed = useSyncExternalStore(elapsedStore.subscribe, elapsedStore.getSnapshot, elapsedStore.getSnapshot);

  if (!visible) return null;

  return (
    <View
      testID="microgame-overlay"
      style={{
        position: "absolute",
        zIndex: 100,
        left: 0,
        right: 0,
        top: 0,
        height,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.paper,
        padding: 24,
      }}
    >
      {kind !== "multitap" ? (
        <Pressable
          onPress={onTap}
          accessibilityRole="button"
          accessibilityLabel="Tap the game screen"
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />
      ) : null}

      {isTest ? (
        <Text accessibilityLabel="Test mode" style={{ position: "absolute", top: 8, right: 8, color: colors.fadedInk, fontSize: 10 }}>
          TEST
        </Text>
      ) : null}

      <MicrogameContent
        kind={kind}
        elapsed={elapsed}
        targetDelay={targetDelay}
        targetSpot={targetSpot}
        leftHanded={leftHanded}
        onTap={onTap}
      />
    </View>
  );
}

type MicrogameContentProps = Pick<MicrogameOverlayProps, "kind" | "targetDelay" | "targetSpot" | "leftHanded" | "onTap"> & { elapsed: number };

function MicrogameContent(props: MicrogameContentProps) {
  switch (props.kind) {
    case "concentration":
      return <ConcentrationMicrogame {...props} />;
    case "timed-attack":
      return <TimedAttackMicrogame {...props} />;
    case "multitap":
      return <MultitapMicrogame {...props} />;
  }
}

function MicrogameTrack({ children }: { children?: React.ReactNode }) {
  return (
    <View style={{ width: "100%", height: 110, position: "relative", marginTop: 24, justifyContent: "center" }}>
      {children}
    </View>
  );
}

function ConcentrationMicrogame({ elapsed, targetSpot, leftHanded, onTap }: MicrogameContentProps) {
  const colors = useThemeColors();
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = Math.max(0, Math.min(1, elapsed / MICROGAME_MAX_DURATION_MS));
  // Match the scoring range as the filled circle moves toward the outline.
  const movingSpot = leftHanded ? 0.1 + 0.8 * progress : 0.9 - 0.8 * progress;

  return (
    <>
      <Text pointerEvents="none" style={{ color: colors.ink, fontSize: 24, fontWeight: "900", textAlign: "center" }}>
        Tap when ● fills ○
      </Text>
      <MicrogameTrack>
        <View onLayout={event => setTrackWidth(event.nativeEvent.layout.width)} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
        <MicrogameCircleOutline pointerEvents="none" size={40} style={{ position: "absolute", left: targetSpot * trackWidth - 20 }} />
        <MicrogameCircle pointerEvents="none" size={44} style={{ position: "absolute", left: movingSpot * trackWidth - 22 }} />
      </MicrogameTrack>
      <Pressable onPress={onTap} accessibilityRole="button" accessibilityLabel="Tap when the filled circle fills the outline" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
    </>
  );
}

function TimedAttackMicrogame({ elapsed, targetDelay }: MicrogameContentProps) {
  const colors = useThemeColors();
  return (
    <>
      <Text pointerEvents="none" style={{ color: colors.ink, fontSize: 24, fontWeight: "900", textAlign: "center" }}>Tap…</Text>
      {elapsed >= targetDelay ? (
        <Text pointerEvents="none" style={{ color: colors.accent, fontSize: 56, fontWeight: "900" }}>NOW!</Text>
      ) : null}
      <MicrogameTrack />
    </>
  );
}

function MultitapMicrogame({ targetSpot, onTap }: MicrogameContentProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const colors = useThemeColors();
  return (
    <>
      <Text pointerEvents="none" style={{ color: colors.ink, fontSize: 24, fontWeight: "900", textAlign: "center" }}>Tap the ●</Text>
      <View onLayout={event => setTrackWidth(event.nativeEvent.layout.width)} style={{ width: "100%", height: 110, position: "relative", marginTop: 24, justifyContent: "center" }}>
        <Pressable onPress={onTap} accessibilityRole="button" accessibilityLabel="Tap circle" style={{ position: "absolute", left: targetSpot * trackWidth - 22 }}>
          <MicrogameCircle size={44} />
        </Pressable>
      </View>
    </>
  );
}
