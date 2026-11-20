import { Header } from "@/components/Common/Displays";
import { NormalButton } from "@/components/Controls/ActionButton";

export function GameHeader({ onMenu }: { onMenu: () => void }) {
  return <Header><NormalButton accessibilityLabel="Menu" accessibilityRole="button" label="Menu" onPress={onMenu} /></Header>;
}
