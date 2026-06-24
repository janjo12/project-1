//#region imports
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useThemeColors, type ThemeColors } from "@/components/theme";

import { ToggleButton } from "@/components/inputs";
import type { GameSettings } from "@/utils/settings-storage";
//#endregion

//#region types
type PauseMenuProps = {
  onBackToGame: () => void;
  onQuitToTitle: () => void;
  onSettingsChange: (settings: Partial<GameSettings>) => void;
  settings: GameSettings;
  visible: boolean;
};
//#endregion


export function PauseMenu({
  onBackToGame,
  onQuitToTitle,
  onSettingsChange,
  settings,
  visible,
}: PauseMenuProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onBackToGame}
      transparent
      visible={visible}
    >
      <View style={styles.pauseBackdrop}>
        <View accessibilityLabel="Game menu" style={styles.pausePanel}>
          <Text style={styles.pauseTitle}>Menu</Text>

          <ToggleButton
            label="Dark Mode"
            value={settings.appearance === "dark"}
            onValueChange={(value) => {
              onSettingsChange({ appearance: value ? "dark" : "light" });
            }}
          />

          <ToggleButton
            label="Vibration"
            value={settings.vibrationEnabled}
            onValueChange={(value) => {
              onSettingsChange({ vibrationEnabled: value });
            }}
          />

          <View style={styles.pauseActions}>
            <PauseButton label="Back to Game" onPress={onBackToGame} />
            <PauseButton
              label="Quit to Title"
              onPress={onQuitToTitle}
              variant="danger"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

type PauseButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "danger" | "primary";
};

function PauseButton({
  label,
  onPress,
  variant = "primary",
}: PauseButtonProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.pauseButton,
        variant === "danger" && styles.pauseDangerButton,
        pressed && styles.pressed,
      ]}
    >
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        style={[
          styles.pauseButtonText,
          variant === "danger" && styles.pauseDangerButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    pauseActions: {
      gap: 10,
    },
    pauseBackdrop: {
      alignItems: "center",
      backgroundColor: "rgba(2, 6, 23, 0.62)",
      flex: 1,
      justifyContent: "center",
      padding: 22,
    },
    pauseButton: {
      alignItems: "center",
      backgroundColor: colors.ink,
      borderColor: colors.ink,
      borderRadius: 10,
      borderWidth: 2,
      justifyContent: "center",
      minHeight: 54,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    pauseButtonText: {
      color: colors.paper,
      fontSize: 22,
      fontWeight: "900",
      textAlign: "center",
    },
    pauseDangerButton: {
      backgroundColor: "transparent",
      borderColor: colors.health,
    },
    pauseDangerButtonText: {
      color: colors.health,
    },
    pausePanel: {
      backgroundColor: colors.paper,
      borderColor: colors.ink,
      borderCurve: "continuous",
      borderRadius: 8,
      borderWidth: 3,
      gap: 28,
      maxWidth: 420,
      padding: 22,
      width: "100%",
    },
    pauseTitle: {
      color: colors.ink,
      fontSize: 34,
      fontWeight: "900",
      textAlign: "center",
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
