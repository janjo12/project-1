import { StyleSheet } from "react-native";

import type { ThemeColors } from "@/components/theme";

export function createInputStyles(colors: ThemeColors) {
  return StyleSheet.create({
    cancelButton: { alignItems: "center", borderCurve: "continuous", borderRadius: 8, justifyContent: "center", minHeight: 40, paddingHorizontal: 8 },
    control: { backgroundColor: colors.paperLight, borderColor: colors.ink, borderCurve: "continuous", borderRadius: 8, borderWidth: 2, flex: 1, flexDirection: "row", minWidth: 0, overflow: "hidden" },
    destructiveButton: { alignItems: "center", backgroundColor: colors.paper, borderColor: colors.health, borderCurve: "continuous", borderRadius: 28, borderWidth: 3, justifyContent: "center", minHeight: 56, paddingHorizontal: 20, paddingVertical: 12 },
    destructiveLabel: { color: colors.health },
    helpIcon: { color: colors.ink, fontSize: 22, fontWeight: "700" },
    helpButton: { alignItems: "center", backgroundColor: colors.paperLight, borderColor: colors.ink, borderRadius: 14, borderWidth: 2, height: 28, justifyContent: "center", width: 28 },
    iconButton: { alignItems: "center", borderCurve: "continuous", borderRadius: 8, justifyContent: "center", minHeight: 40, width: 40 },
    input: { backgroundColor: colors.paperLight, borderColor: colors.ink, borderCurve: "continuous", borderRadius: 8, borderWidth: 2, color: colors.ink, flex: 1, fontSize: 18, fontWeight: "600", minHeight: 44, minWidth: 0, paddingHorizontal: 12, paddingVertical: 6 },
    label: { color: colors.ink, fontSize: 21, fontWeight: "600", textAlign: "center" },
    pressed: { opacity: 0.72 },
    primaryButton: { alignItems: "center", backgroundColor: colors.ink, borderColor: colors.ink, borderCurve: "continuous", borderRadius: 28, borderWidth: 3, justifyContent: "center", minHeight: 56, paddingHorizontal: 20, paddingVertical: 12 },
    primaryLabel: { color: colors.paper },
    radioMark: { backgroundColor: colors.paperLight, borderColor: colors.ink, borderRadius: 999, borderWidth: 3, height: 26, width: 26 },
    radioOption: { alignItems: "center", borderCurve: "continuous", borderRadius: 8, flexDirection: "row", gap: 8, minHeight: 40, paddingHorizontal: 2, paddingVertical: 4 },
    row: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between", minHeight: 58 },
    secondaryLabel: { color: colors.ink, fontSize: 22 },
    segment: { alignItems: "center", flex: 1, justifyContent: "center", minHeight: 42, paddingHorizontal: 6, paddingVertical: 6 },
    segmentText: { color: colors.ink, fontSize: 18, fontWeight: "700", textTransform: "capitalize" },
    selectedRadioMark: { backgroundColor: colors.ink },
    selectedSegment: { backgroundColor: colors.ink },
    selectedText: { color: colors.paperLight },
    textButton: { alignItems: "center", borderCurve: "continuous", borderRadius: 8, justifyContent: "center", minHeight: 40, paddingHorizontal: 8 },
    radioText: { color: colors.ink, fontSize: 18, fontWeight: "600", textTransform: "capitalize" },
    radioGroup: { alignItems: "center", flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between", minHeight: 42, minWidth: 0 },
    toggleLabel: { color: colors.ink, flex: 1, fontSize: 22, fontWeight: "700" },
    toggleRow: { alignItems: "center", backgroundColor: colors.paperLight, borderColor: colors.ink, borderCurve: "continuous", borderRadius: 8, borderWidth: 2, flexDirection: "row", gap: 14, justifyContent: "space-between", minHeight: 48, paddingHorizontal: 12, paddingVertical: 6 },
  });
}
