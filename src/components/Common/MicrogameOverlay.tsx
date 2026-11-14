import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Animated, Easing, Pressable, Text, View, type ViewInstance } from "react-native";

import { StyledText } from "@/components/Common/Displays";
import { MicrogameCircle, MicrogameCircleOutline } from "@/components/Common/MicrogameCircle";
import { useThemeColors } from "@/components/Common/theme";
import { CONCENTRATION_TARGET_DURATION_MS, MULTITAP_DOT_DIAMETER, getMultitapGrid, getMultiswipeGrid, getRuneTracerPattern, isMultiswipeEndpoint, type MicrogameKind, type MultitapTargetSpot, type MultiswipeTarget, type RuneEdge } from "@/game/actions/use-microgame";
import type { NumberStore } from "@/game/state/numberStore";

type MicrogameOverlayProps = {
  visible: boolean;
  kind: MicrogameKind;
  elapsedStore: NumberStore;
  targetDelay: number;
  targetSpot: number;
  leftHanded: boolean;
  multitapTargetSpot: MultitapTargetSpot;
  multiswipeTarget: MultiswipeTarget;
  onTap: (trackWidth?: number, dotDiameter?: number, trackHeight?: number) => void;
  onSwipeStart: (x: number, y: number, width: number, height: number, dotDiameter?: number) => void;
  onSwipeEnd: (x: number, y: number, width: number, height: number, dotDiameter?: number) => boolean;
  onMultiswipeLayout: (width: number, height: number) => void;
  onRuneProgress: (progress: number) => void;
  onRuneComplete: (progress: number) => void;
};

export function MicrogameOverlay({
  visible,
  kind,
  elapsedStore,
  targetDelay,
  targetSpot,
  multitapTargetSpot,
  multiswipeTarget,
  leftHanded,
  onTap,
  onSwipeStart,
  onSwipeEnd,
  onMultiswipeLayout,
  onRuneProgress,
  onRuneComplete,
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
      {kind === "multitap" || kind === "multiswipe" || kind === "rune-tracer" ? (
        <MicrogameContent
          kind={kind}
          elapsed={elapsed}
          panelHeight={panelHeight}
          targetDelay={targetDelay}
          targetSpot={targetSpot}
          multitapTargetSpot={multitapTargetSpot}
          multiswipeTarget={multiswipeTarget}
          leftHanded={leftHanded}
          onTap={onTap}
          onSwipeStart={onSwipeStart}
          onSwipeEnd={onSwipeEnd}
          onMultiswipeLayout={onMultiswipeLayout}
          onRuneProgress={onRuneProgress}
          onRuneComplete={onRuneComplete}
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
              multiswipeTarget={multiswipeTarget}
              leftHanded={leftHanded}
              onTap={onTap}
              onSwipeStart={onSwipeStart}
              onSwipeEnd={onSwipeEnd}
              onMultiswipeLayout={onMultiswipeLayout}
              onRuneProgress={onRuneProgress}
              onRuneComplete={onRuneComplete}
            />
          </View>
        </Pressable>
      )}
    </View>
  );
}

type MicrogameContentProps = Pick<MicrogameOverlayProps, "kind" | "targetDelay" | "targetSpot" | "multitapTargetSpot" | "multiswipeTarget" | "leftHanded" | "onTap" | "onSwipeStart" | "onSwipeEnd" | "onMultiswipeLayout" | "onRuneProgress" | "onRuneComplete"> & { elapsed: number; panelHeight: number };

function MicrogameContent(props: MicrogameContentProps) {
  switch (props.kind) {
    case "concentration":
      return <ConcentrationMicrogame {...props} />;
    case "timed-attack":
      return <TimedAttackMicrogame {...props} />;
    case "multitap":
      return <MultitapMicrogame {...props} />;
    case "multiswipe":
      return <MultiswipeMicrogame {...props} />;
    case "rune-tracer":
      return <RuneTracerMicrogame {...props} />;
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

function IdleBounce({ children, style }: { children: React.ReactNode; style?: object }) {
  const [offset] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(offset, { toValue: -3, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(offset, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [offset]);

  return <Animated.View style={[style, { transform: [{ translateY: offset }] }]}>{children}</Animated.View>;
}

function ConcentrationMicrogame({ elapsed, targetSpot, leftHanded, onTap }: MicrogameContentProps) {
  const colors = useThemeColors();
  const progress = Math.max(0, Math.min(1, elapsed / CONCENTRATION_TARGET_DURATION_MS));
  // Match the scoring range as the filled circle moves toward the outline.
  const movingSpot = leftHanded ? 0.1 + 0.8 * progress : 0.9 - 0.8 * progress;

  return (
    <>
      <IdleBounce>
      <View testID="concentration-instruction" accessible accessibilityRole="text" accessibilityLabel="Tap when the filled circle fills the target circle" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <StyledText style={{ color: colors.ink, fontSize: 20, fontWeight: "800", textAlign: "center" }}>Tap when</StyledText>
        <MicrogameCircle size={18} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
        <StyledText style={{ color: colors.ink, fontSize: 20, fontWeight: "800", textAlign: "center" }}>fills</StyledText>
        <MicrogameCircleOutline size={18} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      </View>
      </IdleBounce>
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
      <IdleBounce><View testID="timed-attack-instruction" pointerEvents="none"><StyledText style={{ color: colors.ink, fontSize: 24, fontWeight: "800", textAlign: "center" }}>Tap...</StyledText></View></IdleBounce>
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
  const progress = Math.max(0, Math.min(1, elapsed / Math.max(1, targetDelay)));
  // The thin moving ring finishes centered in the gap between the two target rings.
  const ringDiameter = 136 - progress * 90;
  const contactReached = elapsed >= targetDelay;
  return (
    <View pointerEvents="none" style={{ alignItems: "center", justifyContent: "center", gap: 18 }}>
      <View testID="defense-instruction" accessibilityLabel="Tap when the thin shrinking ring is in the gap between the two thick target rings">
        <StyledText style={{ color: colors.ink, fontSize: 21, fontWeight: "900", textAlign: "center" }}>Tap when the thin ring reaches the gap</StyledText>
      </View>
      <View testID="defense-cue" accessibilityRole="timer" accessibilityLabel={contactReached ? "Shrinking ring is between the target rings" : "Shrinking ring approaching the gap between target rings"} style={{ alignItems: "center", height: 148, justifyContent: "center", width: 148 }}>
        <View style={{ position: "absolute", width: ringDiameter, height: ringDiameter, borderColor: contactReached ? colors.energy : colors.accent, borderRadius: ringDiameter / 2, borderWidth: 3 }} />
        <View testID="defense-target-outer-ring" style={{ position: "absolute", width: 68, height: 68, borderRadius: 34, borderColor: colors.ink, borderWidth: 8 }} />
        <View testID="defense-target-inner-ring" style={{ position: "absolute", width: 34, height: 34, borderRadius: 17, borderColor: colors.ink, borderWidth: 6 }} />
      </View>
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
      <IdleBounce>
      <View testID="multitap-instruction" accessible accessibilityRole="text" accessibilityLabel="Tap the filled circle as quickly as you can" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
        <StyledText style={{ color: colors.ink, fontSize: 20, fontWeight: "800", textAlign: "center" }}>Tap</StyledText>
        <MicrogameCircle size={18} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      </View>
      </IdleBounce>
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

function MultiswipeMicrogame({ multiswipeTarget, onSwipeStart, onSwipeEnd, onMultiswipeLayout, panelHeight }: MicrogameContentProps) {
  const colors = useThemeColors();
  const [completedStroke, setCompletedStroke] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const [trackHeight, setTrackHeight] = useState(0);
  const [trackOrigin, setTrackOrigin] = useState({ x: 0, y: 0 });
  const trackRef = useRef<ViewInstance>(null);
  const gridHeight = panelHeight > 0 ? Math.max(48, panelHeight * 0.5) : 110;
  const { diameter: dotDiameter } = getMultiswipeGrid(trackWidth, trackHeight, MULTITAP_DOT_DIAMETER);
  const startX = multiswipeTarget.start.x * trackWidth;
  const startY = multiswipeTarget.start.y * trackHeight;
  const endX = multiswipeTarget.end.x * trackWidth;
  const endY = multiswipeTarget.end.y * trackHeight;
  const strokeThickness = (dotDiameter + 10) / 2;
  const path = multiswipeTarget.path ?? [multiswipeTarget.start, multiswipeTarget.end];
  return (
    <>
      <IdleBounce>
      <View testID="multiswipe-instruction" accessible accessibilityRole="text" accessibilityLabel="Swipe Across" style={{ alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 8 }}>
        <StyledText style={{ color: colors.ink, fontSize: 20, fontWeight: "800", textAlign: "center" }}>Swipe Across</StyledText>
        <View testID="multiswipe-instruction-bar" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 36, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
      </View>
      </IdleBounce>
      <View
        ref={trackRef}
        testID="multiswipe-track"
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          setTrackWidth(width);
          setTrackHeight(height);
          onMultiswipeLayout(width, height);
          requestAnimationFrame(() => trackRef.current?.measureInWindow((x, y) => setTrackOrigin({ x, y })));
        }}
        onStartShouldSetResponder={event => {
          if (trackWidth <= 0 || trackHeight <= 0) return false;
          const point = {
            x: (event.nativeEvent.pageX - trackOrigin.x) / trackWidth,
            y: (event.nativeEvent.pageY - trackOrigin.y) / trackHeight,
          };
          return isMultiswipeEndpoint(point, multiswipeTarget.start, trackWidth, trackHeight, dotDiameter) ||
            isMultiswipeEndpoint(point, multiswipeTarget.end, trackWidth, trackHeight, dotDiameter);
        }}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={event => {
          const { pageX, pageY } = event.nativeEvent;
          const localX = pageX - trackOrigin.x;
          const localY = pageY - trackOrigin.y;
          const point = { x: localX / trackWidth, y: localY / trackHeight };
          const startsOnDot = isMultiswipeEndpoint(point, multiswipeTarget.start, trackWidth, trackHeight, dotDiameter) ||
            isMultiswipeEndpoint(point, multiswipeTarget.end, trackWidth, trackHeight, dotDiameter);
          onSwipeStart(localX, localY, trackWidth, trackHeight, dotDiameter);
          return startsOnDot;
        }}
        onResponderRelease={event => {
          const completed = onSwipeEnd(event.nativeEvent.pageX - trackOrigin.x, event.nativeEvent.pageY - trackOrigin.y, trackWidth, trackHeight, dotDiameter);
          if (completed) {
            setCompletedStroke(true);
            setTimeout(() => setCompletedStroke(false), 250);
          }
        }}
        style={{ width: "100%", height: gridHeight, position: "relative", overflow: "hidden" }}
      >
        {path.slice(1).map((point, index) => {
          const from = path[index];
          const x1 = from.x * trackWidth;
          const y1 = from.y * trackHeight;
          const x2 = point.x * trackWidth;
          const y2 = point.y * trackHeight;
          const length = Math.hypot(x2 - x1, y2 - y1);
          const angle = Math.atan2(y2 - y1, x2 - x1);
          return <View key={index} testID={index === 0 ? "multiswipe-bar" : `multiswipe-bar-${index}`} pointerEvents="none" style={{ position: "absolute", left: (x1 + x2) / 2 - length / 2, top: (y1 + y2) / 2 - strokeThickness / 2, width: length, height: strokeThickness, borderRadius: strokeThickness / 2, backgroundColor: completedStroke ? colors.energy : colors.accent, transform: [{ rotate: `${angle}rad` }] }} />;
        })}
        <View testID="multiswipe-start-dot" pointerEvents="none" style={{ position: "absolute", left: startX - dotDiameter / 2, top: startY - dotDiameter / 2 }}><MicrogameCircle size={dotDiameter} style={{ backgroundColor: completedStroke ? colors.energy : colors.accent }} /></View>
        <View testID="multiswipe-end-dot" pointerEvents="none" style={{ position: "absolute", left: endX - dotDiameter / 2, top: endY - dotDiameter / 2 }}><MicrogameCircle size={dotDiameter} style={{ backgroundColor: completedStroke ? colors.energy : colors.accent }} /></View>
      </View>
    </>
  );
}

function RuneTracerMicrogame({ leftHanded, onRuneProgress, onRuneComplete, panelHeight }: MicrogameContentProps) {
  const colors = useThemeColors();
  const [trackWidth, setTrackWidth] = useState(0);
  const [trackHeight, setTrackHeight] = useState(0);
  const [trackOrigin, setTrackOrigin] = useState({ x: 0, y: 0 });
  const [tracedEdges, setTracedEdges] = useState<Set<string>>(() => new Set());
  const trackRef = useRef<ViewInstance>(null);
  const tracingRef = useRef(false);
  const currentNodeRef = useRef<string | null>(null);
  const activeEdgeRef = useRef<RuneEdge | null>(null);
  const tracedEdgeIdsRef = useRef<Set<string>>(new Set());
  const [patternSeed] = useState(() => Math.floor(Math.random() * 0x100000000));
  const gridHeight = panelHeight > 0 ? Math.max(48, panelHeight * 0.5) : 110;
  const pattern = getRuneTracerPattern(trackWidth, trackHeight, leftHanded ? "left" : "right", 28, patternSeed);
  const dotRadius = pattern.diameter / 2;
  const edgeTolerance = 10;

  function markEdge(edge: RuneEdge) {
    if (tracedEdgeIdsRef.current.has(edge.id)) return;
    const next = new Set(tracedEdgeIdsRef.current);
    next.add(edge.id);
    tracedEdgeIdsRef.current = next;
    setTracedEdges(next);
    const progress = next.size / pattern.edges.length;
    onRuneProgress(progress);
    if (next.size === pattern.edges.length) onRuneComplete(progress);
  }

  function beginTrace(pageX: number, pageY: number) {
    if (trackWidth <= 0 || trackHeight <= 0) return;
    const point = { x: (pageX - trackOrigin.x) / trackWidth, y: (pageY - trackOrigin.y) / trackHeight };
    const nodeHit = pattern.nodes.find(node => pixelDistance(point, node.point, trackWidth, trackHeight) <= dotRadius);
    if (nodeHit) {
      tracingRef.current = true;
      currentNodeRef.current = nodeHit.id;
      activeEdgeRef.current = null;
      return;
    }
    const edgeHit = nearestRuneEdge(point, pattern, trackWidth, trackHeight);
    if (edgeHit && edgeHit.distance <= edgeTolerance + 4) {
      tracingRef.current = true;
      currentNodeRef.current = null;
      activeEdgeRef.current = edgeHit.edge;
    }
  }

  function moveTrace(pageX: number, pageY: number) {
    if (!tracingRef.current || trackWidth <= 0 || trackHeight <= 0) return;
    const point = { x: (pageX - trackOrigin.x) / trackWidth, y: (pageY - trackOrigin.y) / trackHeight };
    const nodeHit = pattern.nodes.find(node => pixelDistance(point, node.point, trackWidth, trackHeight) <= dotRadius);
    const activeEdge = activeEdgeRef.current;

    if (activeEdge) {
      const reachedNode = nodeHit && (nodeHit.id === activeEdge.from || nodeHit.id === activeEdge.to) ? nodeHit : null;
      if (reachedNode) {
        markEdge(activeEdge);
        currentNodeRef.current = reachedNode.id;
        activeEdgeRef.current = null;
      } else {
        const distance = runeEdgeDistance(point, activeEdge, pattern, trackWidth, trackHeight);
        if (distance > edgeTolerance + 4) activeEdgeRef.current = null;
      }
      return;
    }

    const currentNode = currentNodeRef.current;
    if (!currentNode) return;
    if (nodeHit && nodeHit.id !== currentNode) {
      const connectedEdge = pattern.edges.find(edge =>
        (edge.from === currentNode && edge.to === nodeHit.id) ||
        (edge.to === currentNode && edge.from === nodeHit.id),
      );
      if (connectedEdge) {
        markEdge(connectedEdge);
        currentNodeRef.current = nodeHit.id;
      }
      return;
    }

    const connectedEdge = pattern.edges
      .filter(edge => edge.from === currentNode || edge.to === currentNode)
      .map(edge => ({ edge, distance: runeEdgeDistance(point, edge, pattern, trackWidth, trackHeight) }))
      .sort((left, right) => left.distance - right.distance)[0];
    if (connectedEdge && connectedEdge.distance <= edgeTolerance) activeEdgeRef.current = connectedEdge.edge;
  }

  function finishTrace() {
    tracingRef.current = false;
    currentNodeRef.current = null;
    activeEdgeRef.current = null;
  }

  return (
    <>
      <IdleBounce style={{ alignItems: "center", marginBottom: 8 }}>
      <View testID="rune-tracer-instruction" accessible accessibilityRole="text" accessibilityLabel="Trace the rune" style={{ alignItems: "center" }}>
        <StyledText style={{ color: colors.ink, fontSize: 20, fontWeight: "800", textAlign: "center" }}>Trace the Rune</StyledText>
      </View>
      </IdleBounce>
      <View
        ref={trackRef}
        testID="rune-tracer-track"
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          setTrackWidth(width);
          setTrackHeight(height);
          tracedEdgeIdsRef.current = new Set();
          setTracedEdges(new Set());
          onRuneProgress(0);
          trackRef.current?.measureInWindow((x, y) => setTrackOrigin({ x, y }));
        }}
        onStartShouldSetResponderCapture={() => true}
        onMoveShouldSetResponderCapture={() => true}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={event => beginTrace(event.nativeEvent.pageX, event.nativeEvent.pageY)}
        onResponderMove={event => moveTrace(event.nativeEvent.pageX, event.nativeEvent.pageY)}
        onResponderRelease={event => {
          moveTrace(event.nativeEvent.pageX, event.nativeEvent.pageY);
          finishTrace();
        }}
        onResponderTerminate={finishTrace}
        onPointerDown={event => beginTrace(event.nativeEvent.pageX, event.nativeEvent.pageY)}
        onPointerMove={event => moveTrace(event.nativeEvent.pageX, event.nativeEvent.pageY)}
        onPointerUp={event => {
          moveTrace(event.nativeEvent.pageX, event.nativeEvent.pageY);
          finishTrace();
        }}
        style={{ width: "100%", height: gridHeight, position: "relative", overflow: "hidden" }}
      >
        {pattern.edges.map(edge => {
          const from = pattern.nodes.find(node => node.id === edge.from)!.point;
          const to = pattern.nodes.find(node => node.id === edge.to)!.point;
          const x1 = from.x * trackWidth;
          const y1 = from.y * trackHeight;
          const x2 = to.x * trackWidth;
          const y2 = to.y * trackHeight;
          const length = Math.hypot(x2 - x1, y2 - y1);
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const strokeThickness = (pattern.diameter + 10) / 2;
          return <View key={edge.id} testID={`rune-edge-${edge.id}`} pointerEvents="none" style={{ position: "absolute", left: (x1 + x2) / 2 - length / 2, top: (y1 + y2) / 2 - strokeThickness / 2, width: length, height: strokeThickness, borderRadius: strokeThickness / 2, backgroundColor: tracedEdges.has(edge.id) ? colors.energy : colors.accent, transform: [{ rotate: `${angle}rad` }] }} />;
        })}
        {pattern.nodes.map(node => {
          const traced = pattern.edges.some(edge => tracedEdges.has(edge.id) && (edge.from === node.id || edge.to === node.id));
          return <View key={node.id} testID={`rune-node-${node.id}`} pointerEvents="none" style={{ position: "absolute", left: node.point.x * trackWidth - dotRadius, top: node.point.y * trackHeight - dotRadius }}><MicrogameCircle size={pattern.diameter} style={{ backgroundColor: traced ? colors.energy : colors.accent }} /></View>;
        })}
      </View>
    </>
  );
}

function pixelDistance(a: MultitapTargetSpot, b: MultitapTargetSpot, width: number, height: number) {
  return Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
}

function nearestRuneEdge(point: MultitapTargetSpot, pattern: ReturnType<typeof getRuneTracerPattern>, width: number, height: number) {
  return pattern.edges
    .map(edge => ({ edge, distance: runeEdgeDistance(point, edge, pattern, width, height) }))
    .sort((left, right) => left.distance - right.distance)[0];
}

function runeEdgeDistance(point: MultitapTargetSpot, edge: RuneEdge, pattern: ReturnType<typeof getRuneTracerPattern>, width: number, height: number) {
  const from = pattern.nodes.find(node => node.id === edge.from)!.point;
  const to = pattern.nodes.find(node => node.id === edge.to)!.point;
  const px = point.x * width;
  const py = point.y * height;
  const x1 = from.x * width;
  const y1 = from.y * height;
  const dx = to.x * width - x1;
  const dy = to.y * height - y1;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  return Math.hypot(px - (x1 + projection * dx), py - (y1 + projection * dy));
}
