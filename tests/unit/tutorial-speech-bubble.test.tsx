import { StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";

import { TutorialSpeechBubble } from "@/components/Common/TutorialSpeechBubble";
import { ThemeProvider } from "@/components/Common/theme";

test.each(["dark", "light"] as const)("tutorial bubbles use the same opaque white speech style in %s mode", async appearance => {
  const view = await render(
    <ThemeProvider appearance={appearance}>
      <TutorialSpeechBubble label="Move" testID="tutorial-move" />
    </ThemeProvider>,
  );
  const bubble = view.getByText("Move").parent;
  const bubbleStyle = StyleSheet.flatten(bubble?.props.style);

  expect(bubbleStyle.backgroundColor).toBe("#ffffff");
  expect(bubbleStyle.borderRadius).toBe(999);
  expect(StyleSheet.flatten(view.getByText("Move").props.style).color).toBe("#111827");
  expect(view.getByTestId("tutorial-move")).toBeTruthy();
  expect(view.getByTestId("tutorial-speech-bubble-tail")).toBeTruthy();
});

test("tutorial speech bubbles respect reduced-motion settings", async () => {
  const view = await render(<TutorialSpeechBubble label="Attack" reducedMotion testID="tutorial-attack" />);
  const rootStyle = StyleSheet.flatten(view.getByTestId("tutorial-attack").props.style);

  expect(rootStyle.animationName).toBeUndefined();
});
