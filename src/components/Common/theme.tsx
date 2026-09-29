import { createContext, PropsWithChildren, useContext } from "react";
import { ColorSchemeName, useColorScheme } from "react-native";

import type { Appearance } from "@/utils/settings-storage";

export const darkColors = {
  accent: "#f97316",
  energy: "#22c55e",
  timer: "#b966ff",
  fadedInk: "#9ca3af",
  health: "#ef4444",
  ink: "#f8fafc",
  mapCurrentRoom: "#92400e",
  mapEnemyRoom: "#7f1d1d",
  mapItemRoom: "#14532d",
  mapStairsRoom: "#5b21b6",
  mapExploredRoom: "#334155",
  mapGrid: "#64748b",
  paper: "#111827",
  paperDark: "#020617",
  paperLight: "#1f2937",
  resourceBorder: "#cbd5e1",
  sepia: "#38bdf8",
};

export const lightColors = {
  accent: "#ea580c",
  energy: "#16a34a",
  timer: "#a855f7",
  fadedInk: "#334155",
  health: "#dc2626",
  ink: "#0f172a",
  mapCurrentRoom: "#ef4444",
  mapEnemyRoom: "#fecaca",
  mapItemRoom: "#bbf7d0",
  mapStairsRoom: "#ddd6fe",
  mapExploredRoom: "#dbeafe",
  mapGrid: "#94a3b8",
  paper: "#f8fafc",
  paperDark: "#dbeafe",
  paperLight: "#e2e8f0",
  resourceBorder: "#475569",
  sepia: "#0284c7",
};

export const colors = darkColors;

export type ThemeColors = typeof darkColors;

type ThemeContextValue = {
  colors: ThemeColors;
  colorScheme: "light" | "dark";
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  colorScheme: "dark",
});

function resolveAppearance(
  appearance: Appearance,
  systemColorScheme: ColorSchemeName,
) {
  if (appearance === "system") {
    return systemColorScheme === "dark" ? "dark" : "light";
  }

  return appearance;
}

type ThemeProviderProps = PropsWithChildren<{
  appearance: Appearance;
}>;

export function ThemeProvider({ appearance, children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const colorScheme = resolveAppearance(appearance, systemColorScheme);

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        colors: colorScheme === "dark" ? darkColors : lightColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeColors() {
  return useContext(ThemeContext).colors;
}

export function useThemeColorScheme() {
  return useContext(ThemeContext).colorScheme;
}
