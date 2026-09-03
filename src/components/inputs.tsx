//#region imports
import { FontAwesome } from "@expo/vector-icons";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

import { createInputStyles } from "@/components/input-styles";
import { useThemeColors } from "@/components/theme";

//#endregion
//#region types
type CancelButtonProps = {
  accessibilityLabel: string;
  accessibilityRole: "button";
  label: string;
  onPress: () => void;
};

type DestructiveButtonProps = {
  accessibilityLabel: string;
  accessibilityRole: "button";
  label: string;
  onPress: () => void;
};

type HelpButtonProps = {
  accessibilityLabel: string;
  accessibilityRole: "button";
  onPress: () => void;
};

type NormalButtonProps = {
  accessibilityLabel: string;
  accessibilityRole: "button";
  icon?: keyof typeof FontAwesome.glyphMap;
  label?: string;
  onPress: () => void;
  testID?: string;
};

type PrimaryButtonProps = {
  accessibilityLabel: string;
  accessibilityRole: "button";
  label: string;
  onPress: () => void;
};

type RadioGroupProps<TValue extends string> = {
  onChange: (value: TValue) => void;
  options: readonly TValue[];
  value: TValue;
};

type SegmentedButtonProps<TValue extends string> = {
  onChange: (value: TValue) => void;
  options: readonly TValue[];
  value: TValue;
};

type SelectableOptionProps = {
  isSelected: boolean;
  label: string;
  onPress: () => void;
  variant: "segment" | "radio";
};

type TextEntryProps = {
  accessibilityLabel: string;
  accessibilityRole: "textbox";
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
};

type ToggleButtonProps = {
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
};
//#endregion

//#region components
export function CancelButton({ label, onPress }: CancelButtonProps) {
  const colors = useThemeColors();
  const styles = createInputStyles(colors);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.cancelButton,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

export function DestructiveButton({ label, onPress }: DestructiveButtonProps) {
  const colors = useThemeColors();
  const styles = createInputStyles(colors);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.destructiveButton,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, styles.destructiveLabel]}>{label}</Text>
    </Pressable>
  );
}

export function HelpButton({ accessibilityLabel, onPress }: HelpButtonProps) {
  const colors = useThemeColors();
  const styles = createInputStyles(colors);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && styles.pressed,
      ]}
    >
      <FontAwesome color={colors.ink} name="question-circle" size={28} />
    </Pressable>
  );
}

export function NormalButton({
  accessibilityLabel,
  icon,
  label,
  onPress,
  testID,
}: NormalButtonProps) {
  const colors = useThemeColors();
  const styles = createInputStyles(colors);

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

export function PrimaryButton({ label, onPress }: PrimaryButtonProps) {
  const colors = useThemeColors();
  const styles = createInputStyles(colors);

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
  const styles = createInputStyles(colors);

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

export function SelectableOption({
  isSelected,
  label,
  onPress,
  variant,
}: SelectableOptionProps) {
  const colors = useThemeColors();
  const styles = createInputStyles(colors);
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
  const styles = createInputStyles(colors);

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

export function TextEntry({
  accessibilityLabel,
  onChangeText,
  placeholder,
  value,
}: TextEntryProps) {
  const colors = useThemeColors();
  const styles = createInputStyles(colors);

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

export function ToggleButton({
  label,
  value,
  onValueChange,
}: ToggleButtonProps) {
  const colors = useThemeColors();
  const styles = createInputStyles(colors);

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
        thumbColor={value ? colors.accent : colors.fadedInk}
        trackColor={{ false: colors.ink, true: colors.ink }}
        value={value}
      />
    </View>
  );
}
//#endregion
