import { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/components/theme";

type SettingsFieldProps = PropsWithChildren<{
  label: string;
}>;

export function SettingsField({ children, label }: SettingsFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "500",
  },
});
