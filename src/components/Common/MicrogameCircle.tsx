import { View, type ViewProps, type ViewStyle } from "react-native";

import { useThemeColors } from "@/components/Common/theme";

type MicrogameCircleProps = Omit<ViewProps, "style"> & {
  size?: number;
  style?: ViewStyle;
};

/** Filled target used by microgames and their instructions. */
export function MicrogameCircle({ size = 44, style, ...props }: MicrogameCircleProps) {
  const colors = useThemeColors();

  return (
    <View
      {...props}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.accent,
        },
        style,
      ]}
    />
  );
}

/** Outline target used by microgames and their instructions. */
export function MicrogameCircleOutline({ size = 40, style, ...props }: MicrogameCircleProps) {
  const colors = useThemeColors();

  return (
    <View
      {...props}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: colors.accent,
          borderWidth: 4,
        },
        style,
      ]}
    />
  );
}
