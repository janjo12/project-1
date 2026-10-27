import React from "react";
import { render, screen } from "@testing-library/react-native";
import { DungeonMap } from "@/components/Dungeon/DungeonMap";
import { createSeededDungeonMap } from "@/game/dungeon/generateDungeon";
import { ThemeProvider } from "@/components/Common/theme";

test("the displayed map grid follows each floor's smaller or larger generated bounds", async () => {
  const earlyFloor = createSeededDungeonMap("map-scale-early", 1);
  const deepFloor = createSeededDungeonMap("map-scale-deep", 10);
  const expectedCells = (map: typeof earlyFloor) => map.columns.length * map.rows.length;
  expect(expectedCells(earlyFloor)).toBeLessThan(expectedCells(deepFloor));

  const view = await render(<ThemeProvider appearance="dark"><DungeonMap currentRoomId={earlyFloor.startingRoomId} map={earlyFloor} /></ThemeProvider>);
  expect(screen.getAllByTestId(/^map-cell-/)).toHaveLength(expectedCells(earlyFloor));
  await view.rerender(<ThemeProvider appearance="dark"><DungeonMap currentRoomId={deepFloor.startingRoomId} map={deepFloor} /></ThemeProvider>);
  expect(screen.getAllByTestId(/^map-cell-/)).toHaveLength(expectedCells(deepFloor));
});
