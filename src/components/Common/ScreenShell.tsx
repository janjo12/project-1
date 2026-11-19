import { memo, PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SpriteFlightLayer } from "@/components/Common/SpriteFlight";
import { type ThemeColors, useThemeColors } from "@/components/Common/theme";

type ScreenShellProps = PropsWithChildren<{
  compact?: boolean;
  health?: number | null;
  maxHealth?: number;
  damageDealtKey?: number;
  reducedMotion?: boolean;
}>;

export function ScreenShell({ children, compact = false, health = null, maxHealth = 100, damageDealtKey = 0, reducedMotion = false }: ScreenShellProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const styles = createStyles(colors);
  const tight = height < 740;
  const [shake] = useState(() => new Animated.Value(0));
  const previousHealth = useRef<number | null>(null);
  const previousDamageDealtKey = useRef(damageDealtKey);
  const [damageFlash] = useState(() => new Animated.Value(0));
  const [lowHealthPulse] = useState(() => new Animated.Value(0));
  const healthRatio = health === null ? 1 : Math.max(0, Math.min(1, health / Math.max(1, maxHealth)));
  const lowHealthLevel = Math.max(0, Math.min(1, (0.3 - healthRatio) / 0.3));

  useEffect(() => {
    if (health === null) {
      previousHealth.current = null;
      damageFlash.stopAnimation();
      damageFlash.setValue(0);
      lowHealthPulse.stopAnimation();
      lowHealthPulse.setValue(0);
      return;
    }
    const previous = previousHealth.current;
    previousHealth.current = health;
    if (previous !== null && health < previous) {
      damageFlash.stopAnimation();
      damageFlash.setValue(0);
      Animated.sequence([
        Animated.timing(damageFlash, { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(damageFlash, { toValue: 0, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
      ]).start();
    }
  }, [damageFlash, health, lowHealthPulse]);

  useEffect(() => {
    lowHealthPulse.stopAnimation();
    lowHealthPulse.setValue(0);
    if (lowHealthLevel <= 0) return;
    if (reducedMotion) {
      lowHealthPulse.setValue(lowHealthLevel * 0.45);
      return;
    }
    const halfCycleMs = 900 - lowHealthLevel * 650;
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(lowHealthPulse, { toValue: lowHealthLevel, duration: halfCycleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(lowHealthPulse, { toValue: 0, duration: halfCycleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web" }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [lowHealthLevel, lowHealthPulse, reducedMotion]);

  useEffect(() => {
    if (damageDealtKey === previousDamageDealtKey.current) return;
    previousDamageDealtKey.current = damageDealtKey;
    if (reducedMotion) return;
    shake.stopAnimation();
    shake.setValue(0);
    Animated.sequence([-4, 4, -3, 3, -1, 1, 0].map(toValue => Animated.timing(shake, {
      toValue,
      duration: 32,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== "web",
    }))).start();
  }, [damageDealtKey, reducedMotion, shake]);

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.phoneFrame,
          compact && styles.compactPhoneFrame,
          tight && styles.tightPhoneFrame,
          { paddingTop: Math.max(8, insets.top + (compact ? 0 : 4)), paddingBottom: Math.max(8, insets.bottom + (compact ? 0 : 4)) },
          { transform: [{ translateX: shake }, { translateY: shake.interpolate({ inputRange: [-4, 0, 4], outputRange: [-2, 0, 2] }) }] },
        ]}
      >
        {children}
      </Animated.View>
      <ScreenEdgeGlow damageFlash={damageFlash} lowHealthPulse={lowHealthPulse} reducedMotion={reducedMotion} />
      <SpriteFlightLayer />
    </View>
  );
}

const EDGE_BANDS = [
  { offset: 0, depth: 8, opacity: 0.34 },
  { offset: 8, depth: 12, opacity: 0.24 },
  { offset: 20, depth: 18, opacity: 0.15 },
  { offset: 38, depth: 26, opacity: 0.085 },
  { offset: 64, depth: 36, opacity: 0.04 },
];
const SCREEN_EDGES = ["top", "right", "bottom", "left"] as const;

const ScreenEdgeGlow = memo(function ScreenEdgeGlow({ damageFlash, lowHealthPulse, reducedMotion }: { damageFlash: Animated.Value; lowHealthPulse: Animated.Value; reducedMotion: boolean }) {
  const bands = useMemo(() => SCREEN_EDGES.flatMap(edge => EDGE_BANDS.map((band, index) => {
    const edgeStyle = edge === "top" ? { left: 0, right: 0, top: band.offset, height: band.depth }
      : edge === "bottom" ? { bottom: band.offset, left: 0, right: 0, height: band.depth }
        : edge === "left" ? { bottom: 0, left: band.offset, top: 0, width: band.depth }
          : { bottom: 0, right: band.offset, top: 0, width: band.depth };
    const flash = damageFlash.interpolate({ inputRange: [0, 1], outputRange: [0, band.opacity] });
    const pulse = lowHealthPulse.interpolate({ inputRange: [0, 1], outputRange: [0, band.opacity * (reducedMotion ? 0.6 : 1)] });
    return { key: `${edge}-${index}`, edgeStyle, opacity: Animated.add(flash, pulse) };
  })), [damageFlash, lowHealthPulse, reducedMotion]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bands.map(band => <Animated.View key={band.key} style={[{ position: "absolute", backgroundColor: "#e11d48", opacity: band.opacity }, band.edgeStyle]} />)}
    </View>
  );
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      backgroundColor: colors.paper,
      flex: 1,
      height: "100%",
      overflow: "hidden",
      position: "relative",
    },
    phoneFrame: {
      backgroundColor: colors.paper,
      flex: 1,
      gap: 12,
      justifyContent: "center",
      paddingHorizontal: 16,
      width: "100%",
    },
    compactPhoneFrame: {
      gap: 4,
      justifyContent: "space-between",
      paddingHorizontal: 8,
    },
    tightPhoneFrame: {
      gap: 6,
      paddingHorizontal: 10,
    },
  });
}
