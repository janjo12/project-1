//#region imports
import { FontAwesome } from "@expo/vector-icons";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { type ThemeColors, useThemeColors } from "@/components/theme";

//#endregion

//#region types
type RadioGroupProps<TValue extends string> = {
  onChange: (value: TValue) => void;
  options: readonly TValue[];
  value: TValue;
};

type TextEntryProps = {
  accessibilityLabel: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
};

type SegmentedButtonProps<TValue extends string> = {
  onChange: (value: TValue) => void;
  options: readonly TValue[];
  value: TValue;
};

type ScreenActionButtonProps = {
  accessibilityLabel: string;
  icon?: keyof typeof FontAwesome.glyphMap;
  label?: string;
  onPress: () => void;
  testID?: string;
};

type SelectableOptionProps = {
  isSelected: boolean;
  label: string;
  onPress: () => void;
  variant: "segment" | "radio";
};

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
};

type ToggleButtonProps = {
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
};
//#endregion

export function TextEntry({
  accessibilityLabel,
  onChangeText,
  placeholder,
  value,
}: TextEntryProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      autoCapitalize="none"
      autoCorrect={false}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.fadedInk}
      selectionColor={colors.accent}
      style={styles.input}
      value={value}
    />
  );
}

export function PrimaryButton({ label, onPress }: AppButtonProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, styles.primaryLabel]}>{label}</Text>
    </Pressable>
  );
}

export function RadioGroup<TValue extends string>({
  onChange,
  options,
  value,
}: RadioGroupProps<TValue>) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View accessibilityRole="radiogroup" style={styles.radioGroup}>
      {options.map((option) => (
        <SelectableOption
          isSelected={value === option}
          key={option}
          label={option}
          onPress={() => onChange(option)}
          variant="radio"
        />
      ))}
    </View>
  );
}

export function ScreenActionButton({
  accessibilityLabel,
  icon,
  label,
  onPress,
  testID,
}: ScreenActionButtonProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        icon ? styles.iconButton : styles.textButton,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      {icon ? <FontAwesome color={colors.ink} name={icon} size={28} /> : null}
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

export function SelectableOption({
  isSelected,
  label,
  onPress,
  variant,
}: SelectableOptionProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const isRadio = variant === "radio";

  return (
    <Pressable
      accessibilityRole={isRadio ? "radio" : "button"}
      accessibilityState={
        isRadio ? { checked: isSelected } : { selected: isSelected }
      }
      onPress={onPress}
      style={[
        isRadio ? styles.radioOption : styles.segment,
        !isRadio && isSelected && styles.selectedSegment,
      ]}
    >
      {isRadio && (
        <View
          style={[styles.radioMark, isSelected && styles.selectedRadioMark]}
        />
      )}
      <Text
        adjustsFontSizeToFit={!isRadio}
        numberOfLines={1}
        style={[
          isRadio ? styles.radioText : styles.segmentText,
          !isRadio && isSelected && styles.selectedText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SegmentedButton<TValue extends string>({
  onChange,
  options,
  value,
}: SegmentedButtonProps<TValue>) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.control}>
      {options.map((option) => (
        <SelectableOption
          isSelected={value === option}
          key={option}
          label={option}
          onPress={() => onChange(option)}
          variant="segment"
        />
      ))}
    </View>
  );
}

export function AppButton({
  label,
  onPress,
  variant = "primary",
}: AppButtonProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const isPrimary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.appButton,
        isPrimary ? styles.appButtonPrimary : styles.appButtonSecondary,
        pressed && styles.pressed,
      ]}
    >
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        style={[
          styles.appButtonLabel,
          isPrimary ? styles.primaryLabel : styles.secondaryLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ToggleButton({
  label,
  value,
  onValueChange,
}: ToggleButtonProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.toggleRow}>
      <Text numberOfLines={1} style={styles.toggleLabel}>
        {label}
      </Text>
      <Switch
        accessibilityLabel={label}
        ios_backgroundColor={colors.paperLight}
        onValueChange={(newValue) => {
          onValueChange(newValue);
        }}
        thumbColor={value ? colors.paper : colors.fadedInk}
        trackColor={{ false: colors.paperLight, true: colors.accent }}
        value={value}
      />
    </View>
  );
}
  
function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      justifyContent: "space-between",
      minHeight: 58,
    },
    input: {
      backgroundColor: colors.paperLight,
      borderColor: colors.ink,
      borderCurve: "continuous",
      borderRadius: 8,
      borderWidth: 2,
      color: colors.ink,
      fontSize: 22,
      fontWeight: "600",
      minHeight: 56,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    iconButton: {
      alignItems: "center",
      borderCurve: "continuous",
      borderRadius: 8,
      justifyContent: "center",
      minHeight: 44,
      width: 44,
    },
    label: {
      color: colors.ink,
      fontSize: 25,
      fontWeight: "600",
      textAlign: "center",
    },
    pressed: {
      opacity: 0.72,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.ink,
      borderColor: colors.ink,
      borderCurve: "continuous",
      borderRadius: 28,
      borderWidth: 3,
      justifyContent: "center",
      minHeight: 72,
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    appButton: {
      alignItems: "center",
      borderCurve: "continuous",
      borderRadius: 28,
      borderWidth: 3,
      justifyContent: "center",
      minHeight: 64,
      paddingHorizontal: 24,
      paddingVertical: 14,
    },
    appButtonPrimary: {
      backgroundColor: colors.ink,
      borderColor: colors.ink,
    },
    appButtonSecondary: {
      backgroundColor: colors.paper,
      borderColor: colors.ink,
      borderRadius: 8,
      borderWidth: 2,
      minHeight: 54,
    },
    appButtonLabel: {
      fontSize: 25,
      fontWeight: "800",
      textAlign: "center",
    },
    primaryLabel: {
      color: colors.paper,
    },
    secondaryLabel: {
      color: colors.ink,
      fontSize: 22,
    },
    textButton: {
      alignItems: "center",
      borderCurve: "continuous",
      borderRadius: 8,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 8,
    },
    segment: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      minHeight: 54,
      paddingHorizontal: 8,
      paddingVertical: 10,
    },
    selectedSegment: {
      backgroundColor: colors.ink,
    },
    segmentText: {
      color: colors.ink,
      fontSize: 22,
      fontWeight: "700",
      textTransform: "capitalize",
    },
    selectedText: {
      color: colors.paperLight,
    },
    radioOption: {
      alignItems: "center",
      borderCurve: "continuous",
      borderRadius: 8,
      flexDirection: "row",
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 4,
      paddingVertical: 6,
    },
    radioMark: {
      backgroundColor: colors.paperLight,
      borderColor: colors.ink,
      borderRadius: 999,
      borderWidth: 3,
      height: 26,
      width: 26,
    },
    selectedRadioMark: {
      backgroundColor: colors.ink,
    },
    radioText: {
      color: colors.ink,
      fontSize: 23,
      fontWeight: "600",
      textTransform: "capitalize",
    },
    control: {
      backgroundColor: colors.paperLight,
      borderColor: colors.ink,
      borderCurve: "continuous",
      borderRadius: 8,
      borderWidth: 2,
      flexDirection: "row",
      overflow: "hidden",
    },
    radioGroup: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 18,
      justifyContent: "space-between",
      minHeight: 58,
    },
    toggleRow: {
      alignItems: "center",
      backgroundColor: colors.paperLight,
      borderColor: colors.ink,
      borderCurve: "continuous",
      borderRadius: 8,
      borderWidth: 2,
      flexDirection: "row",
      gap: 14,
      justifyContent: "space-between",
      minHeight: 58,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    toggleLabel: {
      color: colors.ink,
      flex: 1,
      fontSize: 22,
      fontWeight: "700",
    },
  });
}
