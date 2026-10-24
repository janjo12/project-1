import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ItemControl, EquipmentControl } from "@/components/Controls/ActionMenu";
import { EquipmentDetailsMenu, ItemDetailsMenu } from "@/components/Controls/InventoryDetailsMenu";
import { ThemeProvider } from "@/components/Common/theme";
import { PauseMenu } from "@/components/Common/PauseMenu";
import { DEFAULT_GAME_SETTINGS } from "@/utils/settings-storage";

function renderThemed(element: React.ReactNode) {
  return render(<ThemeProvider appearance="dark">{element}</ThemeProvider>);
}

test("empty inventory slots are hidden and occupied item and equipment slots appear", () => {
  const empty = renderThemed(<><ItemControl /><EquipmentControl /></>);
  expect(empty.queryByTestId("item-status")).toBeNull();
  expect(empty.queryByTestId("equipment-slot")).toBeNull();
  empty.unmount();

  renderThemed(<>
    <ItemControl itemLabel="Health Potion" activationDescription="Restores Health when you reach zero." />
    <EquipmentControl label="Good Armor" description="Raises Defense by 1." />
  </>);
  expect(screen.getByText("Health Potion")).toBeTruthy();
  expect(screen.getByText("Good Armor")).toBeTruthy();
});

test("item and equipment details menus show replacement and activation instructions", () => {
  const dropEquipment = jest.fn();
  function InventoryMenuHarness() {
    const [menu, setMenu] = useState<"item" | "equipment" | null>(null);
    return <>
      <ItemControl itemLabel="Silver Bullet" activationDescription="Automatically defeats the Werewolf." onDrop={() => setMenu("item")} />
      <EquipmentControl label="Spyglass" description="Reveals the full map." onDrop={() => setMenu("equipment")} />
      <ItemDetailsMenu visible={menu === "item"} label="Silver Bullet" description="A rare shot." activationDescription="Automatically defeats the Werewolf." onClose={() => setMenu(null)} />
      <EquipmentDetailsMenu visible={menu === "equipment"} label="Spyglass" description="Reveals the full map." onDrop={() => { dropEquipment(); setMenu(null); }} onClose={() => setMenu(null)} />
    </>;
  }

  renderThemed(<InventoryMenuHarness />);
  fireEvent.press(screen.getByRole("button", { name: "Silver Bullet. Drop item" }));
  expect(screen.getByText("A rare shot.")).toBeTruthy();
  expect(screen.getAllByText("Automatically defeats the Werewolf.").length).toBeGreaterThan(1);
  expect(screen.getByText(/Pick up another item at any time/)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Close item details" }));

  fireEvent.press(screen.getByRole("button", { name: "Spyglass. Drop equipment" }));
  expect(screen.getAllByText("Reveals the full map.").length).toBeGreaterThan(1);
  expect(screen.getByText(/Pick up another piece of equipment at any time/)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Drop equipment" }));
  expect(dropEquipment).toHaveBeenCalledTimes(1);
});

test("instructions are kept behind the Instructions option in the pause menu", () => {
  renderThemed(<PauseMenu
    onBackToGame={jest.fn()} onQuitToTitle={jest.fn()} onPractice={jest.fn()}
    onSettingsChange={jest.fn()} microgamesEnabled level={3} microgameAverage={76}
    settings={DEFAULT_GAME_SETTINGS} visible
  />);
  expect(screen.queryByText(/Each action advances the turn/)).toBeNull();
  fireEvent.press(screen.getByRole("button", { name: "Open instructions" }));
  expect(screen.getByText(/Each action advances the turn/)).toBeTruthy();
  expect(screen.getByText("Level 3")).toBeTruthy();
  expect(screen.getByText("Running microgame average: 76% of maximum score")).toBeTruthy();
});
