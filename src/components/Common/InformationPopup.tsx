import { ScrollView, View, useWindowDimensions } from "react-native";

import { StyledModal, StyledText, Title } from "@/components/Common/Displays";
import { NormalButton, PrimaryButton } from "@/components/Controls/ActionButton";

type PopupAction = {
  accessibilityLabel: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

export function InformationPopup({
  visible,
  title,
  messages,
  onClose,
  closeLabel = "Got it",
  dialogAccessibilityLabel = `${title} information`,
  closeAccessibilityLabel = closeLabel,
  action,
}: {
  visible: boolean;
  title: string;
  messages: string[];
  onClose: () => void;
  closeLabel?: string;
  dialogAccessibilityLabel?: string;
  closeAccessibilityLabel?: string;
  action?: PopupAction;
}) {
  const { height } = useWindowDimensions();
  const compact = height < 500;
  return (
    <StyledModal
      accessibilityLabel={dialogAccessibilityLabel}
      accessibilityRole="dialog"
      animationType="fade"
      contentTestID="information-popup-card"
      onRequestClose={onClose}
      visible={visible}
    >
        <Title testID="information-popup-title">
          {title}
        </Title>
        <ScrollView
          testID="information-popup-body"
          showsVerticalScrollIndicator
          style={{ flexShrink: 1, maxHeight: Math.max(72, height - (compact ? 218 : 248)), minHeight: 0, width: "100%" }}
          contentContainerStyle={{ gap: 10, paddingBottom: messages.length > 0 ? 4 : 0 }}
        >
          {messages.map((message, index) => (
            <StyledText key={`${index}-${message}`} testID={`information-popup-message-${index}`}>
              {message}
            </StyledText>
          ))}
        </ScrollView>
        <View style={{ gap: 8, width: "100%" }}>
          {action ? <NormalButton accessibilityLabel={action.accessibilityLabel} accessibilityRole="button" label={action.label} disabled={action.disabled} onPress={action.onPress} /> : null}
          <PrimaryButton accessibilityLabel={closeAccessibilityLabel} accessibilityRole="button" label={closeLabel} onPress={onClose} />
        </View>
    </StyledModal>
  );
}
