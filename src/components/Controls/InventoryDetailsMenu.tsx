import { InformationPopup } from "@/components/Common/InformationPopup";

export function ItemDetailsMenu({
  visible,
  label,
  description,
  activationDescription,
  onUseNow,
  showUseNow = false,
  useNowDisabled = false,
  onClose,
}: {
  visible: boolean;
  label: string;
  description: string;
  activationDescription: string;
  onUseNow?: () => void;
  showUseNow?: boolean;
  useNowDisabled?: boolean;
  onClose: () => void;
}) {
  return <InformationPopup
    visible={visible}
    title={label}
    messages={[description, activationDescription, "Pick up another item at any time. The item you are carrying will be dropped on the ground in this room."]}
    onClose={onClose}
    closeLabel="Close"
    dialogAccessibilityLabel="Item details"
    closeAccessibilityLabel="Close item details"
    action={showUseNow ? { accessibilityLabel: "Use item now", label: "Use Item Now", disabled: useNowDisabled, onPress: onUseNow ?? onClose } : undefined}
  />;
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
  return <InformationPopup
    visible={visible}
    title={label}
    messages={[description, "Pick up another piece of equipment at any time. Your current equipment will be dropped on the ground in this room."]}
    onClose={onClose}
    closeLabel="Close"
    dialogAccessibilityLabel="Equipment details"
    closeAccessibilityLabel="Close equipment details"
    action={{ accessibilityLabel: "Drop equipment", label: "Drop Equipment", disabled: dropDisabled, onPress: onDrop }}
  />;
}
