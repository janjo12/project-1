//#region imports
import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type ThemeColors, useThemeColors } from "@/components/theme";
//#endregion

//#region types
type FormFieldProps = PropsWithChildren<{
  helpLabel?: string;
  label: string;
  onHelpPress?: () => void;
}>;
//#endregion

export function Container({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return <View style={styles.container}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.title}>
      <Text style={styles.label}>{children}</Text>
    </View>
  );
}

export function Header({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return <View style={styles.header}>{children}</View>;
}

export function Footer({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return <View style={styles.footer}>{children}</View>;
}

export function FormField({
  children,
  helpLabel,
  label,
  onHelpPress,
}: FormFieldProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {onHelpPress ? (
          <Pressable
            accessibilityLabel={helpLabel ?? `${label} help`}
            accessibilityRole="button"
            onPress={onHelpPress}
            style={styles.helpButton}
          >
            <Text style={styles.helpIcon}>?</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      gap: 22,
      justifyContent: "flex-start",
      paddingBottom: 20,
      paddingTop: 16,
    },
    helpButton: {
      alignItems: "center",
      backgroundColor: colors.paperLight,
      borderColor: colors.ink,
      borderRadius: 14,
      borderWidth: 2,
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    helpIcon: {
      color: colors.ink,
      fontSize: 18,
      fontWeight: "700",
      lineHeight: 22,
    },
    label: {
      color: colors.ink,
      fontSize: 26,
      fontWeight: "500",
    },
    labelRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
    },
    title: {
      alignItems: "center",
      gap: 8,
      justifyContent: "center",
      minHeight: 36,
      fontSize: 80,
    },
    footer: {
      paddingTop: 8,
    },
    header: {
      alignItems: "flex-start",
      minHeight: 36,
    },
  });
}
