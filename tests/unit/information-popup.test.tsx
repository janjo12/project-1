import { StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";

import { darkColors, lightColors, ThemeProvider } from "@/components/Common/theme";
import { InformationPopup } from "@/components/Common/InformationPopup";

test.each(["dark", "light"] as const)("information popup matches menu theme and stays still in %s mode", async appearance => {
  const view = await render(
    <ThemeProvider appearance={appearance}>
      <InformationPopup
        visible
        title="How to progress"
        messages={["Use arrows to move, or unlock a door or defeat a monster to progress."]}
        onClose={jest.fn()}
      />
    </ThemeProvider>,
  );

  const card = view.getByTestId("information-popup-card");
  const cardStyle = StyleSheet.flatten(card.props.style);
  const themeColors = appearance === "dark" ? darkColors : lightColors;

  expect(cardStyle.backgroundColor).toBe(themeColors.paper);
  expect(cardStyle.borderRadius).toBe(12);
  expect(card.type).toBe("View");
  expect(cardStyle.animationName).toBeUndefined();
  expect(cardStyle.animationDuration).toBeUndefined();
  expect(cardStyle.transform).toBeUndefined();
  expect(view.queryByTestId("information-popup-tail")).toBeNull();
  expect(view.getByTestId("information-popup-title")).toHaveTextContent("How to progress");
  expect(StyleSheet.flatten(view.getByTestId("information-popup-title").props.style)).toMatchObject({ color: themeColors.ink, fontSize: 38, fontWeight: "500" });
  expect(StyleSheet.flatten(view.getByTestId("information-popup-message-0").props.style)).toMatchObject({ color: themeColors.fadedInk, fontSize: 17 });
  expect(view.getByText("Use arrows to move, or unlock a door or defeat a monster to progress.")).toBeTruthy();
});

test("long informational copy stays in a bounded scroll body above its actions", async () => {
  const longMessage = "Detailed information that remains available by scrolling. ".repeat(40);
  const view = await render(
    <ThemeProvider appearance="dark">
      <InformationPopup
        visible
        title="Detailed item information"
        messages={[longMessage, longMessage]}
        action={{ accessibilityLabel: "Use item now", label: "Use Item Now", onPress: jest.fn() }}
        onClose={jest.fn()}
      />
    </ThemeProvider>,
  );

  const body = view.getByTestId("information-popup-body");
  expect(body.type).toBe("RCTScrollView");
  expect(body.props.style.maxHeight).toBeGreaterThan(0);
  expect(view.getAllByText(longMessage)).toHaveLength(2);
  expect(view.getByRole("button", { name: "Use item now" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Got it" })).toBeTruthy();
});
