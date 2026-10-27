import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Animated, Easing, Platform, View, type ViewInstance } from "react-native";

import { PixelSprite } from "@/components/Common/PixelSprite";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";

export type ScreenPoint = { x: number; y: number };
export type SpriteFlightRequest = { start: ScreenPoint; end: ScreenPoint; sprite: string; label: string };
type SpriteFlight = SpriteFlightRequest & { id: number };

let activeFlight: SpriteFlight | null = null;
let nextFlightId = 0;
const flightListeners = new Set<() => void>();

export function animateSpriteFlight(request: SpriteFlightRequest) {
  activeFlight = { ...request, id: ++nextFlightId };
  flightListeners.forEach(listener => listener());
}

export function measureViewCenterNow(view: ViewInstance | null): ScreenPoint | null {
  if (!view) return null;
  const element = view as unknown as { getBoundingClientRect?: () => DOMRect };
  if (typeof element.getBoundingClientRect !== "function") return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function measureViewCenter(view: ViewInstance | null): Promise<ScreenPoint | null> {
  return new Promise(resolve => {
    if (!view) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (point: ScreenPoint | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(point);
    };
    const timeout = setTimeout(() => finish(null), 250);

    // React Native Web host refs are DOM elements; use their box directly so a
    // missing native measurement callback cannot stall the pickup action.
    const center = measureViewCenterNow(view);
    if (center) {
      finish(center);
      return;
    }
    if (Platform.OS === "web") {
      finish(null);
      return;
    }
    view.measureInWindow((x, y, width, height) => {
      finish(width > 0 && height > 0 ? { x: x + width / 2, y: y + height / 2 } : null);
    });
  });
}

function subscribeToFlight(listener: () => void) {
  flightListeners.add(listener);
  return () => flightListeners.delete(listener);
}

function finishFlight(id: number) {
  if (activeFlight?.id !== id) return;
  activeFlight = null;
  flightListeners.forEach(listener => listener());
}

export function SpriteFlightLayer() {
  const flight = useSyncExternalStore(subscribeToFlight, () => activeFlight, () => null);
  const [translation] = useState(() => new Animated.ValueXY());
  const layerRef = useRef<ViewInstance>(null);
  const [origin, setOrigin] = useState<ScreenPoint>({ x: 0, y: 0 });

  useEffect(() => {
    if (!flight) return;
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;
    layerRef.current?.measureInWindow((x, y) => {
      if (cancelled) return;
      setOrigin({ x, y });
      translation.setValue({ x: 0, y: 0 });
      animation = Animated.timing(translation, {
        toValue: { x: flight.end.x - flight.start.x, y: flight.end.y - flight.start.y },
        duration: GAME_PARAMETERS.animation.spriteFlightDurationMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      });
      animation.start(({ finished }) => { if (finished) finishFlight(flight.id); });
    });
    return () => { cancelled = true; animation?.stop(); };
  }, [flight?.id, translation]);

  if (!flight) return null;
  return (
    <View ref={layerRef} pointerEvents="none" style={{ position: "absolute", zIndex: 1000, left: 0, top: 0, right: 0, bottom: 0 }}>
      <Animated.View testID="sprite-flight-animation" style={{
        position: "absolute", left: flight.start.x - origin.x - 16, top: flight.start.y - origin.y - 16,
        transform: [{ translateX: translation.x }, { translateY: translation.y }],
      }}>
        <PixelSprite sprite={flight.sprite} label={flight.label} size={32} />
      </Animated.View>
    </View>
  );
}
