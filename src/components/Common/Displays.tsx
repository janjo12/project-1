import {
  Modal,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useThemeColors, type ThemeColors } from "@/components/Common/theme";

type ChildrenProps = {
  children: React.ReactNode;
};

type ViewProps = ChildrenProps & {
  style?: StyleProp<ViewStyle>;
};

type StyledModalProps = ChildrenProps & {
  accessibilityLabel: string;
  accessibilityRole: string;
  animationType: "none" | "slide" | "fade";
  onRequestClose: () => void;
  visible: boolean;
};

type StyledTextProps = ChildrenProps & {
  style?: StyleProp<TextStyle>;
};

export function Container({ children }: ViewProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return <View style={styles.container}>{children}</View>;
}

export function Row({ children, style }: ViewProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return <View style={[styles.row, style]}>{children}</View>;
}

export function Footer({ children }: ChildrenProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return <View style={styles.footer}>{children}</View>;
}

export function Header({ children, style }: ViewProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return <View style={[styles.header, style]}>{children}</View>;
}

export function StyledModal({
  children,
  animationType,
  onRequestClose,
  accessibilityLabel,
  visible,
}: StyledModalProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <Modal 
      accessibilityLabel={accessibilityLabel}
      animationType={animationType}
      transparent={true}
      onRequestClose={onRequestClose}
      visible={visible}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>{children}</View>
      </View>
    </Modal>
  );
}

export function StyledText({ children, style }: StyledTextProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return <Text style={[styles.styledText, style]}>{children}</Text>;
}

export function Title({ children }: ChildrenProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return <Text style={styles.title}>{children}</Text>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: 10,
      justifyContent: "flex-start",
      paddingBottom: 4,
      paddingTop: 4,
      width: "100%",
    },
    footer: {
      paddingTop: 8,
    },
    header: {
      alignItems: "flex-start",
      minHeight: 28,
    },
    modalContent: {
      backgroundColor: colors.paper,
      borderRadius: 12,
      gap: 16,
      marginHorizontal: 20,
      maxWidth: 380,
      padding: 18,
      width: "88%",
    },
    modalOverlay: {
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      flex: 1,
      justifyContent: "center",
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      justifyContent: "space-between",
      width: "100%",
    },
    styledText: {
      color: colors.fadedInk,
      fontSize: 17,
      fontVariant: ["tabular-nums"],
      fontWeight: "500",
      minWidth: 0,
      textAlign: "left",
    },
    title: {
      color: colors.ink,
      fontSize: 38,
      fontWeight: "500",
      minHeight: 28,
      textAlign: "center",
    },
  });
}
