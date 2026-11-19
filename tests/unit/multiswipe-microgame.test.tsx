import { act, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { MicrogameOverlay } from "@/components/Common/MicrogameOverlay";
import { MULTITAP_DOT_DIAMETER, getMultiswipeGrid } from "@/game/actions/use-microgame";
import { createNumberStore } from "@/game/state/numberStore";

test.each([
  ["right-handed", false, "50%", 0],
  ["left-handed", true, 0, "50%"],
] as const)("Multiswipe confines its swipe area and straight bar to the %s side", async (_hand, leftHanded, expectedLeft, expectedRight) => {
  const target = {
    start: { x: 0.2, y: 0.2 },
    end: { x: 0.8, y: 0.8 },
    axis: "diagonal" as const,
  };
  const view = await render(
    <MicrogameOverlay
      visible
      kind="multiswipe"
      elapsedStore={createNumberStore(0)}
      progress={0}
      targetDelay={0}
      targetSpot={0.5}
      leftHanded={leftHanded}
      multitapTargetSpot={{ x: 0.76, y: 0.5 }}
      multiswipeTarget={target}
      onTap={() => undefined}
      onSwipeStart={() => undefined}
      onSwipeEnd={() => false}
      onMultiswipeLayout={() => undefined}
      onRuneProgress={() => undefined}
      onRuneComplete={() => undefined}
    />,
  );
  const track = view.getByTestId("multiswipe-track");
  await act(async () => track.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 110 } } }));
  expect(StyleSheet.flatten(track.props.style)).toMatchObject({ position: "absolute", left: expectedLeft, right: expectedRight });

  const bars = view.getAllByTestId(/^multiswipe-bar(?:-\d+)?$/);
  expect(bars).toHaveLength(1);
  const barStyle = StyleSheet.flatten(bars[0].props.style);
  const rotation = Number.parseFloat((barStyle.transform[0] as { rotate: string }).rotate);
  expect(rotation).not.toBe(0);
  expect(barStyle.width).toBeCloseTo(Math.hypot(360 * 0.6, 110 * 0.6));
  expect(barStyle.height).toBeGreaterThanOrEqual(12);
  expect(barStyle.borderRadius).toBe(barStyle.height / 2);
  expect(barStyle.shadowOpacity).toBeUndefined();
  expect(view.queryByTestId("multiswipe-cursor-glow")).toBeNull();

  const trackEvent = (x: number, y: number) => ({ nativeEvent: { pageX: x, pageY: y } });
  await act(async () => {
    track.props.onResponderGrant(trackEvent(target.start.x * 360, target.start.y * 110));
    track.props.onResponderMove(trackEvent(180, 55));
  });
  const barFillStyle = StyleSheet.flatten(view.getByTestId("multiswipe-bar-fill").props.style);
  expect(barFillStyle.backgroundColor).toBe("#22c55e");
  expect(barFillStyle.width).toBeCloseTo(barStyle.width / 2);
  expect(barFillStyle.height).toBe(barStyle.height);
  expect(barFillStyle.borderRadius).toBe(barStyle.borderRadius);
  expect(barFillStyle.transform).toEqual(barStyle.transform);
  const fillLength = barStyle.width / 2;
  const deltaX = (target.end.x - target.start.x) * 360;
  const deltaY = (target.end.y - target.start.y) * 110;
  expect(barFillStyle.left + fillLength / 2).toBeCloseTo(target.start.x * 360 + deltaX / 4);
  expect(barFillStyle.top + barStyle.height / 2).toBeCloseTo(target.start.y * 110 + deltaY / 4);
  await act(async () => {
    track.props.onResponderGrant(trackEvent(target.end.x * 360, target.end.y * 110));
    track.props.onResponderMove(trackEvent(180, 55));
  });
  const reverseFillStyle = StyleSheet.flatten(view.getByTestId("multiswipe-bar-fill").props.style);
  expect(reverseFillStyle.width).toBeCloseTo(barStyle.width / 2);
  expect(reverseFillStyle.height).toBe(barStyle.height);
  expect(reverseFillStyle.borderRadius).toBe(barStyle.borderRadius);
  expect(reverseFillStyle.transform).toEqual(barStyle.transform);
  expect(reverseFillStyle.left + fillLength / 2).toBeCloseTo(target.end.x * 360 - deltaX / 4);
  expect(reverseFillStyle.top + barStyle.height / 2).toBeCloseTo(target.end.y * 110 - deltaY / 4);

  const startDot = StyleSheet.flatten(view.getByTestId("multiswipe-start-dot").props.style);
  const endDot = StyleSheet.flatten(view.getByTestId("multiswipe-end-dot").props.style);
  const dotRadius = getMultiswipeGrid(360, 110, MULTITAP_DOT_DIAMETER).diameter / 2;
  expect(startDot.left + dotRadius).toBeCloseTo(target.start.x * 360);
  expect(startDot.top + dotRadius).toBeCloseTo(target.start.y * 110);
  expect(endDot.left + dotRadius).toBeCloseTo(target.end.x * 360);
  expect(endDot.top + dotRadius).toBeCloseTo(target.end.y * 110);
});
