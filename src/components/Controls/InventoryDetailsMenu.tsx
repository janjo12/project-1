import { StyledModal, StyledText, Title } from "@/components/Common/Displays";
import { NormalButton, PrimaryButton } from "@/components/Controls/ActionButton";

export function ItemDetailsMenu({
  visible,
  label,
  description,
  activationDescription,
  onClose,
}: {
  visible: boolean;
  label: string;
  description: string;
  activationDescription: string;
  onClose: () => void;
}) {
  return <StyledModal accessibilityLabel="Item details" accessibilityRole="dialog" animationType="fade" onRequestClose={onClose} visible={visible}>
    <Title>{label}</Title>
    <StyledText>{description}</StyledText>
    <StyledText>{activationDescription}</StyledText>
    <StyledText>Pick up another item at any time. The item you are carrying will be dropped on the ground in this room.</StyledText>
    <PrimaryButton accessibilityLabel="Close item details" accessibilityRole="button" label="Close" onPress={onClose} />
  </StyledModal>;
}

export function EquipmentDetailsMenu({
  visible,
  label,
  description,
  onDrop,
  onClose,
  dropDisabled = false,
}: {
  visible: boolean;
  label: string;
  description: string;
  onDrop: () => void;
  onClose: () => void;
  dropDisabled?: boolean;
}) {
  return <StyledModal accessibilityLabel="Equipment details" accessibilityRole="dialog" animationType="fade" onRequestClose={onClose} visible={visible}>
    <Title>{label}</Title>
    <StyledText>{description}</StyledText>
    <StyledText>Pick up another piece of equipment at any time. Your current equipment will be dropped on the ground in this room.</StyledText>
    <NormalButton accessibilityLabel="Drop equipment" accessibilityRole="button" label="Drop Equipment" disabled={dropDisabled} onPress={onDrop} />
    <PrimaryButton accessibilityLabel="Close equipment details" accessibilityRole="button" label="Close" onPress={onClose} />
  </StyledModal>;
}
