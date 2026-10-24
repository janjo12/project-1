import { useState, useSyncExternalStore } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";

import { MicrogameCircle, MicrogameCircleOutline } from "@/components/Common/MicrogameCircle";
import { useThemeColors } from "@/components/Common/theme";
import { CONCENTRATION_TARGET_DURATION_MS, type MicrogameKind } from "@/game/actions/use-microgame";
import type { NumberStore } from "@/game/state/numberStore";

type MicrogameOverlayProps = {
  visible: boolean;
  kind: MicrogameKind;
  elapsedStore: NumberStore;
  targetDelay: number;
  targetSpot: number;
  leftHanded: boolean;
  onTap: () => void;
};

export function MicrogameOverlay({
  visible,
  kind,
  elapsedStore,
  targetDelay,
  targetSpot,
  leftHanded,
  onTap,
}: MicrogameOverlayProps) {
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
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
        padding: 24,
      }}
    >
      {kind === "multitap" ? (
        <MicrogameContent
          kind={kind}
          elapsed={elapsed}
          targetDelay={targetDelay}
          targetSpot={targetSpot}
          leftHanded={leftHanded}
          onTap={onTap}
        />
      ) : (
        <Pressable
          onPress={onTap}
          accessibilityRole="button"
          accessibilityLabel="Tap the game screen"
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
        >
          <View pointerEvents="none" style={{ alignItems: "center", justifyContent: "center", width: "100%" }}>
            <MicrogameContent
              kind={kind}
              elapsed={elapsed}
              targetDelay={targetDelay}
              targetSpot={targetSpot}
              leftHanded={leftHanded}
              onTap={onTap}
            />
          </View>
        </Pressable>
      )}
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

function MicrogameTrack({ children, testID }: { children?: React.ReactNode; testID?: string }) {
  return (
    <View testID={testID} style={{ width: "100%", height: 110, position: "relative", marginTop: 24, justifyContent: "center" }}>
      {children}
    </View>
  );
}

function ConcentrationMicrogame({ elapsed, targetSpot, leftHanded, onTap }: MicrogameContentProps) {
  const colors = useThemeColors();
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = Math.max(0, Math.min(1, elapsed / CONCENTRATION_TARGET_DURATION_MS));
  // Match the scoring range as the filled circle moves toward the outline.
  const movingSpot = leftHanded ? 0.1 + 0.8 * progress : 0.9 - 0.8 * progress;

  return (
    <>
      <MicrogameTrack testID="concentration-track">
        <View onLayout={event => setTrackWidth(event.nativeEvent.layout.width)} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
        <MicrogameCircleOutline testID="concentration-target" accessibilityLabel="Target outline" pointerEvents="none" size={40} style={{ position: "absolute", left: targetSpot * trackWidth - 20 }} />
        <MicrogameCircle testID="concentration-mover" accessibilityLabel="Moving target" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: movingSpot * 100 }} pointerEvents="none" size={44} style={{ position: "absolute", left: movingSpot * trackWidth - 22 }} />
      </MicrogameTrack>
    </>
  );
}

function TimedAttackMicrogame({ elapsed, targetDelay }: MicrogameContentProps) {
  const colors = useThemeColors();
  const cueVisible = elapsed >= targetDelay;
  return (
    <>
      <View style={{ height: 68, alignItems: "center", justifyContent: "center" }}>
        {cueVisible ? (
          <Text testID="timed-attack-now" accessibilityRole="timer" accessibilityLabel="NOW cue" pointerEvents="none" style={{ color: colors.accent, fontSize: 56, fontWeight: "900" }}>NOW!</Text>
        ) : null}
      </View>
      <Text testID="timed-attack-instruction" pointerEvents="none" style={{ color: colors.ink, fontSize: 24, fontWeight: "800" }}>Tap...</Text>
      <MicrogameTrack />
    </>
  );
}

function MultitapMicrogame({ targetSpot, onTap }: MicrogameContentProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const { height } = useWindowDimensions();
  return (
    <>
      <View onLayout={event => setTrackWidth(event.nativeEvent.layout.width)} style={{ width: "100%", height: height <= 600 ? 48 : 110, position: "relative", marginTop: height <= 600 ? 8 : 24, justifyContent: "center" }}>
        <Pressable onPress={onTap} accessibilityRole="button" accessibilityLabel="Tap circle" style={{ position: "absolute", left: targetSpot * trackWidth - 22 }}>
          <MicrogameCircle size={44} />
        </Pressable>
      </View>
    </>
  );
}
