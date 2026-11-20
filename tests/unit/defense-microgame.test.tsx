import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { MicrogameOverlay } from "@/components/Common/MicrogameOverlay";
import { createNumberStore } from "@/game/state/numberStore";

async function renderDefense(elapsed: number, targetDelay: number) {
  const onTap = jest.fn();
  const view = await render(
    <MicrogameOverlay
      visible
      kind="defense"
      elapsedStore={createNumberStore(elapsed)}
      progress={0}
      targetDelay={targetDelay}
      targetSpot={0.5}
      leftHanded={false}
      multitapTargetSpot={{ x: 0.76, y: 0.5 }}
      multiswipeTarget={{ start: { x: 0.2, y: 0.5 }, end: { x: 0.8, y: 0.5 }, axis: "horizontal" }}
      onTap={onTap}
      onSwipeStart={() => undefined}
      onSwipeEnd={() => false}
      onMultiswipeLayout={() => undefined}
      onRuneProgress={() => undefined}
      onRuneComplete={() => undefined}
    />,
  );
  return { view, onTap };
}

test("Block keeps its original color until clicked, then turns green only inside the target gap", async () => {
  const { view, onTap } = await renderDefense(600, 600);
  const ring = view.getByTestId("defense-shrinking-ring");
  const outerTarget = view.getByTestId("defense-target-outer-ring");
  const initialRingStyle = StyleSheet.flatten(ring.props.style);
  const targetStyle = StyleSheet.flatten(outerTarget.props.style);

  expect(initialRingStyle.borderColor).toBe("#f97316");
  expect(initialRingStyle.width).toBe(58);
  expect(targetStyle.borderColor).toBe(initialRingStyle.borderColor);

  await fireEvent.press(view.getByRole("button", { name: "Tap the game screen" }));

  expect(StyleSheet.flatten(view.getByTestId("defense-shrinking-ring").props.style).borderColor).toBe("#22c55e");
  expect(StyleSheet.flatten(view.getByTestId("defense-target-outer-ring").props.style).borderColor).toBe("#f97316");
  expect(onTap).toHaveBeenCalledWith(undefined, undefined, undefined, 600);
});

test("Block turns red after an early click and leaves the previous scoring input intact", async () => {
  const { view, onTap } = await renderDefense(0, 600);
  const ring = view.getByTestId("defense-shrinking-ring");
  expect(StyleSheet.flatten(ring.props.style).borderColor).toBe("#f97316");

  await fireEvent.press(view.getByRole("button", { name: "Tap the game screen" }));

  expect(StyleSheet.flatten(view.getByTestId("defense-shrinking-ring").props.style).borderColor).toBe("#ef4444");
  expect(onTap).toHaveBeenCalledWith(undefined, undefined, undefined, 0);
});
