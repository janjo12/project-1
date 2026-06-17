import { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { type ThemeColors, useThemeColors } from "@/components/theme";

type FormFieldProps = PropsWithChildren<{
  label: string;
}>;

export function FormField({ children, label }: FormFieldProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "500",
  },
  });
}
