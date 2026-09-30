import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { createInputStyles } from "@/components/Controls/input-styles";
import { useThemeColors } from "@/components/Common/theme";

type ButtonProps = { accessibilityLabel: string; accessibilityRole: "button"; label: string; onPress: () => void };
type SelectableOptionProps = { isSelected: boolean; label: string; onPress: () => void; variant: "segment" | "radio" };

export function CancelButton({ label, onPress }: ButtonProps) {
  const colors = useThemeColors(); const styles = createInputStyles(colors);
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}><Text style={styles.label}>{label}</Text></Pressable>;
}
export function DestructiveButton({ label, onPress }: ButtonProps) {
  const colors = useThemeColors(); const styles = createInputStyles(colors);
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.destructiveButton, pressed && styles.pressed]}><Text style={[styles.label, styles.destructiveLabel]}>{label}</Text></Pressable>;
}
export function HelpButton({ accessibilityLabel, onPress }: Omit<ButtonProps, "label">) {
  const colors = useThemeColors(); const styles = createInputStyles(colors);
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.helpButton, pressed && styles.pressed]}><Text style={[styles.helpIcon, { color: colors.ink }]}>?</Text></Pressable>;
}
export function NormalButton({ accessibilityLabel, icon, label, onPress, testID }: Omit<ButtonProps, "label"> & { icon?: "cog"; label?: string; testID?: string }) {
  const colors = useThemeColors(); const styles = createInputStyles(colors);
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={onPress} testID={testID} style={({ pressed }) => [icon ? styles.iconButton : styles.textButton, pressed && styles.pressed]}>{icon ? <Text style={{ color: colors.ink, fontSize: 24 }}>⚙</Text> : null}{label ? <Text style={styles.label}>{label}</Text> : null}</Pressable>;
}
export function PrimaryButton({ label, onPress }: ButtonProps) {
  const colors = useThemeColors(); const styles = createInputStyles(colors);
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={[styles.label, styles.primaryLabel]}>{label}</Text></Pressable>;
}
export function SelectableOption({ isSelected, label, onPress, variant }: SelectableOptionProps) {
  const styles = createInputStyles(useThemeColors()); const radio = variant === "radio";
  return <Pressable accessibilityRole={radio ? "radio" : "button"} accessibilityState={radio ? { checked: isSelected } : { selected: isSelected }} onPress={onPress} style={[radio ? styles.radioOption : styles.segment, !radio && isSelected && styles.selectedSegment]}>{radio ? <View style={[styles.radioMark, isSelected && styles.selectedRadioMark]} /> : null}<Text numberOfLines={1} style={[radio ? styles.radioText : styles.segmentText, !radio && isSelected && styles.selectedText]}>{label}</Text></Pressable>;
}
export function SegmentedButton<TValue extends string>({ onChange, options, value }: { onChange: (value: TValue) => void; options: readonly TValue[]; value: TValue }) {
  const styles = createInputStyles(useThemeColors());
  return <View style={styles.control}>{options.map(option => <SelectableOption isSelected={value === option} key={option} label={option} onPress={() => onChange(option)} variant="segment" />)}</View>;
}
export function RadioGroup<TValue extends string>({ onChange, options, value }: { onChange: (value: TValue) => void; options: readonly TValue[]; value: TValue }) {
  const styles = createInputStyles(useThemeColors());
  return <View accessibilityRole="radiogroup" style={styles.radioGroup}>{options.map(option => <SelectableOption isSelected={value === option} key={option} label={option} onPress={() => onChange(option)} variant="radio" />)}</View>;
}
export function TextEntry({ accessibilityLabel, onChangeText, placeholder, value }: { accessibilityLabel: string; accessibilityRole: "textbox"; onChangeText: (value: string) => void; placeholder: string; value: string }) {
  const colors = useThemeColors(); const styles = createInputStyles(colors);
  return <TextInput accessibilityLabel={accessibilityLabel} autoCapitalize="none" autoCorrect={false} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.fadedInk} selectionColor={colors.accent} style={styles.input} value={value} />;
}
export function ToggleButton({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  const colors = useThemeColors(); const styles = createInputStyles(colors);
  return <View style={styles.toggleRow}><Text numberOfLines={1} style={styles.toggleLabel}>{label}</Text><Switch accessibilityLabel={label} onValueChange={onValueChange} value={value} trackColor={{ false: colors.fadedInk, true: colors.accent }} /></View>;
}
