import { useState, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";

import { MicrogameCircle, MicrogameCircleOutline } from "@/components/Common/MicrogameCircle";
import { useThemeColors } from "@/components/Common/theme";
import { CONCENTRATION_TARGET_DURATION_MS, MULTITAP_DOT_DIAMETER, getMultitapGrid, type MicrogameKind, type MultitapTargetSpot } from "@/game/actions/use-microgame";
import type { NumberStore } from "@/game/state/numberStore";

type MicrogameOverlayProps = {
  visible: boolean;
  kind: MicrogameKind;
  elapsedStore: NumberStore;
  targetDelay: number;
  targetSpot: number;
  leftHanded: boolean;
  multitapTargetSpot: MultitapTargetSpot;
  onTap: (trackWidth?: number, dotDiameter?: number, trackHeight?: number) => void;
};

export function MicrogameOverlay({
  visible,
  kind,
  elapsedStore,
  targetDelay,
  targetSpot,
  multitapTargetSpot,
  leftHanded,
  onTap,
}: MicrogameOverlayProps) {
  const elapsed = useSyncExternalStore(elapsedStore.subscribe, elapsedStore.getSnapshot, elapsedStore.getSnapshot);
  const [panelHeight, setPanelHeight] = useState(0);

  if (!visible) return null;

  return (
    <View
      testID="microgame-overlay"
      onLayout={event => setPanelHeight(event.nativeEvent.layout.height)}
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
          panelHeight={panelHeight}
          targetDelay={targetDelay}
          targetSpot={targetSpot}
          multitapTargetSpot={multitapTargetSpot}
          leftHanded={leftHanded}
          onTap={onTap}
        />
      ) : (
        <Pressable
          onPress={() => onTap()}
          accessibilityRole="button"
          accessibilityLabel="Tap the game screen"
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
        >
          <View pointerEvents="none" style={{ alignItems: "center", justifyContent: "center", width: "100%" }}>
            <MicrogameContent
              kind={kind}
              elapsed={elapsed}
              panelHeight={panelHeight}
              targetDelay={targetDelay}
              targetSpot={targetSpot}
              multitapTargetSpot={multitapTargetSpot}
              leftHanded={leftHanded}
              onTap={onTap}
            />
          </View>
        </Pressable>
      )}
    </View>
  );
}

type MicrogameContentProps = Pick<MicrogameOverlayProps, "kind" | "targetDelay" | "targetSpot" | "multitapTargetSpot" | "leftHanded" | "onTap"> & { elapsed: number; panelHeight: number };

function MicrogameContent(props: MicrogameContentProps) {
  switch (props.kind) {
    case "concentration":
      return <ConcentrationMicrogame {...props} />;
    case "timed-attack":
      return <TimedAttackMicrogame {...props} />;
    case "multitap":
      return <MultitapMicrogame {...props} />;
    case "defense":
      return <DefenseMicrogame {...props} />;
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
  const progress = Math.max(0, Math.min(1, elapsed / CONCENTRATION_TARGET_DURATION_MS));
  // Match the scoring range as the filled circle moves toward the outline.
  const movingSpot = leftHanded ? 0.1 + 0.8 * progress : 0.9 - 0.8 * progress;

  return (
    <>
      <View testID="concentration-instruction" accessible accessibilityRole="text" accessibilityLabel="Tap when the filled circle fills the target circle" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "800" }}>Tap when</Text>
        <MicrogameCircle size={18} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "800" }}>fills</Text>
        <MicrogameCircleOutline size={18} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      </View>
      <MicrogameTrack testID="concentration-track">
        <MicrogameCircleOutline testID="concentration-target" accessibilityLabel="Target outline" pointerEvents="none" size={40} style={{ position: "absolute", left: `${targetSpot * 100}%`, top: "50%", marginLeft: -20, marginTop: -20 }} />
        <MicrogameCircle testID="concentration-mover" accessibilityLabel="Moving target" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: movingSpot * 100 }} pointerEvents="none" size={44} style={{ position: "absolute", left: `${movingSpot * 100}%`, top: "50%", marginLeft: -22, marginTop: -22 }} />
      </MicrogameTrack>
    </>
  );
}

function TimedAttackMicrogame({ elapsed, targetDelay }: MicrogameContentProps) {
  const colors = useThemeColors();
  const cueVisible = elapsed >= targetDelay;
  return (
    <View style={{ alignItems: "center" }}>
      <Text testID="timed-attack-instruction" pointerEvents="none" style={{ color: colors.ink, fontSize: 24, fontWeight: "800" }}>Tap...</Text>
      <View style={{ height: 68, alignItems: "center", justifyContent: "center" }}>
        {cueVisible ? (
          <Text testID="timed-attack-now" accessibilityRole="timer" accessibilityLabel="NOW cue" pointerEvents="none" style={{ color: colors.accent, fontSize: 56, fontWeight: "900" }}>NOW!</Text>
        ) : null}
      </View>
      <MicrogameTrack />
    </View>
  );
}

function DefenseMicrogame({ elapsed, targetDelay }: MicrogameContentProps) {
  const colors = useThemeColors();
  const cueVisible = elapsed >= targetDelay;
  return (
    <View pointerEvents="none" style={{ alignItems: "center", justifyContent: "center", gap: 8 }}>
      <Text testID="defense-instruction" accessibilityLabel="Tap to defend" style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>Tap to defend</Text>
      <Text testID="defense-cue" accessibilityRole="timer" accessibilityLabel={cueVisible ? "Block now" : "Get ready to block"} style={{ color: cueVisible ? colors.accent : colors.sepia, fontSize: 36, fontWeight: "900" }}>
        {cueVisible ? "BLOCK!" : "…"}
      </Text>
    </View>
  );
}

function MultitapMicrogame({ multitapTargetSpot, leftHanded, onTap, panelHeight }: MicrogameContentProps) {
  const colors = useThemeColors();
  const [trackWidth, setTrackWidth] = useState(0);
  const [trackHeight, setTrackHeight] = useState(0);
  const gridHeight = panelHeight > 0 ? Math.max(48, panelHeight * 0.5) : 110;
  const { diameter: dotDiameter } = getMultitapGrid(trackWidth, trackHeight, MULTITAP_DOT_DIAMETER);
  const gridRegionStyle = leftHanded
    ? { left: 0, right: "50%" as const }
    : { left: "50%" as const, right: 0 };
  return (
    <>
      <View testID="multitap-instruction" accessible accessibilityRole="text" accessibilityLabel="Tap the filled circle as quickly as you can" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "800" }}>Tap</Text>
        <MicrogameCircle size={18} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      </View>
      <View testID="multitap-track" onLayout={event => {
        setTrackWidth(event.nativeEvent.layout.width);
        setTrackHeight(event.nativeEvent.layout.height);
      }} style={{ width: "100%", height: gridHeight, position: "relative", overflow: "hidden" }}>
        <View testID="multitap-grid-region" pointerEvents="none" style={{ position: "absolute", ...gridRegionStyle, top: 0, bottom: 0 }} />
        <Pressable onPress={() => onTap(trackWidth, dotDiameter, trackHeight)} accessibilityRole="button" accessibilityLabel="Tap circle" testID="multitap-target" style={{ position: "absolute", left: `${multitapTargetSpot.x * 100}%`, top: `${multitapTargetSpot.y * 100}%`, marginLeft: -dotDiameter / 2, marginTop: -dotDiameter / 2 }}>
          <MicrogameCircle size={dotDiameter} />
        </Pressable>
      </View>
    </>
  );
}
