import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "@/components/theme";

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
};

export function AppButton({
  label,
  onPress,
  variant = "primary",
}: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.secondary,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, variant === "secondary" && styles.smallLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.paperLight,
    borderColor: colors.ink,
    borderRadius: 28,
    borderWidth: 3,
    justifyContent: "center",
    minHeight: 72,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  secondary: {
    borderRadius: 10,
    borderWidth: 2,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  label: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "600",
    textAlign: "center",
  },
  smallLabel: {
    fontSize: 22,
  },
  pressed: {
    opacity: 0.72,
  },
});
