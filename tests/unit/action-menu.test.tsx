import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ItemControl, EquipmentControl } from "@/components/Controls/ActionMenu";
import { EquipmentDetailsMenu, ItemDetailsMenu } from "@/components/Controls/InventoryDetailsMenu";
import { ThemeProvider } from "@/components/Common/theme";
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
  await empty.unmount();

  await renderThemed(<>
    <ItemControl itemLabel="Health Potion" onPress={jest.fn()} />
    <EquipmentControl label="Good Armor" onPress={jest.fn()} />
  </>);
  expect(screen.getByText("Health Potion")).toBeTruthy();
  expect(screen.getByText("Good Armor")).toBeTruthy();
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

test("instructions are kept behind the Instructions option in the pause menu", async () => {
  await renderThemed(<PauseMenu
    onBackToGame={jest.fn()} onQuitToTitle={jest.fn()} onPractice={jest.fn()}
    onSettingsChange={jest.fn()} microgamesEnabled classId="cleric" level={3} microgameAverage={76}
    settings={DEFAULT_GAME_SETTINGS} seed={DEFAULT_GAME_SETTINGS.seed} visible
  />);
  expect(screen.queryByText(/Each action advances the turn/)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Open instructions" }));
  expect(screen.getByText(/Each action advances the turn/)).toBeTruthy();
  expect(screen.getByText("Level 3")).toBeTruthy();
  expect(screen.getByText("Running microgame average: 76% of maximum score")).toBeTruthy();
  expect(screen.getByText("Aid: Tap yourself to gain +5 Defense for 2 turns. Charge Up first to also restore 10 Health.")).toBeTruthy();
});
