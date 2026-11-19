import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ChargeControl, ItemControl, EquipmentControl } from "@/components/Controls/ActionMenu";
import { EquipmentDetailsMenu, ItemDetailsMenu } from "@/components/Controls/InventoryDetailsMenu";
import { darkColors, lightColors, ThemeProvider } from "@/components/Common/theme";
import { PauseMenu } from "@/components/Common/PauseMenu";
import { DEFAULT_GAME_SETTINGS } from "@/utils/settings-storage";

async function renderThemed(element: React.ReactNode) {
  return render(<ThemeProvider appearance="dark">{element}</ThemeProvider>);
}

test("empty inventory slots are hidden and occupied item and equipment slots appear", async () => {
  const empty = await renderThemed(<><ItemControl /><EquipmentControl /></>);
  expect(empty.queryByTestId("item-status")).toBeNull();
  expect(empty.queryByTestId("equipment-slot")).toBeNull();
  expect(empty.getByTestId("item-flight-target").props.style.opacity).toBe(0);
  expect(empty.getByTestId("equipment-flight-target").props.style.opacity).toBe(0);
  expect(empty.getByTestId("item-flight-target").props.style.flex).toBe(1);
  await empty.unmount();

  await renderThemed(<>
    <ItemControl itemLabel="Health Potion" onPress={jest.fn()} />
    <EquipmentControl label="Good Armor" onPress={jest.fn()} />
  </>);
  expect(screen.getByText("Health Potion")).toBeTruthy();
  expect(screen.getByText("Good Armor")).toBeTruthy();
});

test("item and charge controls fit their reserved one-third width when equipment is acquired", async () => {
  const screen = await renderThemed(
    <View style={{ flexDirection: "row", gap: 6 }}>
      <ItemControl itemLabel="Health Potion" itemSprite="health_potion_graphic" />
      <EquipmentControl label="Lightweight Armor" sprite="armor_graphic" />
      <ChargeControl charged={false} chargeCost={2} disabled={false} onPress={jest.fn()} />
    </View>,
  );

  const item = screen.getByRole("button", { name: "Health Potion" });
  const equipment = screen.getByRole("button", { name: "Lightweight Armor" });
  const charge = screen.getByTestId("charge-up-button");
  for (const control of [item, equipment, charge]) {
    const styles = Array.isArray(control.props.style) ? control.props.style : [control.props.style];
    const flat = Object.assign({}, ...styles.filter(style => style && typeof style === "object"));
    expect(flat.flex).toBe(1);
    expect(flat.minWidth ?? 0).toBe(0);
  }
  expect(screen.getByText("Health Potion").props.numberOfLines).toBe(2);
  expect(screen.getByText("Charge up").props.numberOfLines).toBe(1);
});

test("item and equipment details menus show replacement and activation instructions", async () => {
  const dropEquipment = jest.fn();
  function InventoryMenuHarness() {
    const [menu, setMenu] = useState<"item" | "equipment" | null>(null);
    return <>
      <ItemControl itemLabel="Silver Arrow" onPress={() => setMenu("item")} />
      <EquipmentControl label="Spyglass" onPress={() => setMenu("equipment")} />
      <ItemDetailsMenu visible={menu === "item"} label="Silver Arrow" description="A rare shot." activationDescription="Automatically defeats the Werewolf." onClose={() => setMenu(null)} />
      <EquipmentDetailsMenu visible={menu === "equipment"} label="Spyglass" description="Reveals the full map." onDrop={() => { dropEquipment(); setMenu(null); }} onClose={() => setMenu(null)} />
    </>;
  }

  await renderThemed(<InventoryMenuHarness />);
  await fireEvent.press(screen.getByRole("button", { name: "Silver Arrow" }));
  expect(screen.getByTestId("item-status").props.children.filter(Boolean)).toHaveLength(1);
  expect(screen.getByTestId("item-status").props.children.filter(Boolean)[0].props.children).toBe("Silver Arrow");
  expect(screen.getByText("A rare shot.")).toBeTruthy();
  expect(screen.getByText("Automatically defeats the Werewolf.")).toBeTruthy();
  expect(screen.getByText(/Pick up another item at any time/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Close item details" }));

  await fireEvent.press(screen.getByRole("button", { name: "Spyglass" }));
  expect(screen.getByText("Reveals the full map.")).toBeTruthy();
  expect(screen.getByText(/Pick up another piece of equipment at any time/)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Drop equipment" }));
  expect(dropEquipment).toHaveBeenCalledTimes(1);
});

test.each(["dark", "light"] as const)("equipment popup action has readable contrast in %s mode", async appearance => {
  const view = await render(
    <ThemeProvider appearance={appearance}>
      <EquipmentDetailsMenu visible label="Spyglass" description="Reveals the full map." onDrop={jest.fn()} onClose={jest.fn()} />
    </ThemeProvider>,
  );
  const button = view.getByRole("button", { name: "Drop equipment" });
  const label = view.getByText("Drop Equipment");
  const cardStyle = StyleSheet.flatten(view.getByTestId("information-popup-card").props.style);
  const labelStyle = StyleSheet.flatten(label.props.style);
  const themeColors = appearance === "dark" ? darkColors : lightColors;
  expect(cardStyle.backgroundColor).toBe(themeColors.paper);
  expect(labelStyle.color).not.toBe(cardStyle.backgroundColor);
  expect(labelStyle.color).toBe(themeColors.ink);
  expect(button).toBeTruthy();
});

test("only health potions, stamina meals, and clocks offer Use Item Now", async () => {
  const onUseNow = jest.fn();
  const supportedItems = ["Health Potion", "Stamina Meal", "Clock"];
  for (const label of supportedItems) {
    const view = await render(
      <ThemeProvider appearance="dark">
        <ItemDetailsMenu visible label={label} description="An item." activationDescription="Activates when needed." showUseNow onUseNow={onUseNow} onClose={jest.fn()} />
      </ThemeProvider>,
    );
    const button = view.getByRole("button", { name: "Use item now" });
    expect(button).toBeTruthy();
    await fireEvent.press(button);
    await view.unmount();
  }
  expect(onUseNow).toHaveBeenCalledTimes(supportedItems.length);

  const unsupported = await render(
    <ThemeProvider appearance="dark">
      <ItemDetailsMenu visible label="Key" description="Opens a door." activationDescription="Activates on use." onClose={jest.fn()} />
    </ThemeProvider>,
  );
  expect(unsupported.queryByRole("button", { name: "Use item now" })).toBeNull();
});

test("pause menu practice actions are attacking and defending rather than a fixed attack microgame", async () => {
  const onPracticeAttacking = jest.fn();
  const onPracticeDefending = jest.fn();
  const view = await renderThemed(<PauseMenu
    onBackToGame={jest.fn()} onQuitToTitle={jest.fn()} onPracticeAttacking={onPracticeAttacking} onPracticeDefending={onPracticeDefending}
    onSettingsChange={jest.fn()} microgamesEnabled classId="warrior" level={1} microgameAverage={null}
    settings={DEFAULT_GAME_SETTINGS} seed={DEFAULT_GAME_SETTINGS.seed} visible
  />);

  expect(view.getByRole("button", { name: "Practice Attacking" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Practice Defending" })).toBeTruthy();
  expect(view.queryByText("Practice Rune Tracer")).toBeNull();
  await fireEvent.press(view.getByRole("button", { name: "Practice Attacking" }));
  await fireEvent.press(view.getByRole("button", { name: "Practice Defending" }));
  expect(onPracticeAttacking).toHaveBeenCalledTimes(1);
  expect(onPracticeDefending).toHaveBeenCalledTimes(1);
});

test("instructions are kept behind the Instructions option in the pause menu", async () => {
  await renderThemed(<PauseMenu
    onBackToGame={jest.fn()} onQuitToTitle={jest.fn()} onPracticeAttacking={jest.fn()} onPracticeDefending={jest.fn()}
    onSettingsChange={jest.fn()} microgamesEnabled classId="cleric" level={3} microgameAverage={76}
    settings={DEFAULT_GAME_SETTINGS} seed={DEFAULT_GAME_SETTINGS.seed} visible
  />);
  expect(screen.queryByText(/Each action advances the turn/)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Open instructions" }));
  expect(screen.getByText(/Each action advances the turn/)).toBeTruthy();
  expect(screen.getByText("Level 3")).toBeTruthy();
  expect(screen.getByText("Running microgame average: 76% of maximum score")).toBeTruthy();
  expect(screen.getByText("Aid: Tap yourself to gain +5 Defense for 2 turns. Charge Up first to also restore 10 Health.")).toBeTruthy();
  expect(screen.getByText("Miracle: Once per level, if you would die without a Health Potion, survive with half your maximum Health. It does not use Energy.")).toBeTruthy();
});
