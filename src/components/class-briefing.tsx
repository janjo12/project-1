import { Text, View } from "react-native";

import { StyledText } from "@/components/displays";
import { NormalButton, PrimaryButton } from "@/components/inputs";
import { useThemeColors } from "@/components/theme";
import { getGameClass, getSupportDescription, type GameClassId } from "@/game-classes";

type ClassBriefingProps = {
  classId: GameClassId;
  page: number;
  damage: number;
  multiplayer: boolean;
  onNext: () => void;
  onBack: () => void;
  onPractice: () => void;
  onStart: () => void;
};

export function ClassBriefing({
  classId,
  page,
  damage,
  multiplayer,
  onNext,
  onBack,
  onPractice,
  onStart,
}: ClassBriefingProps) {
  const colors = useThemeColors();
  const gameClass = getGameClass(classId);
  const panelStyle = {
    position: "absolute" as const,
    zIndex: 90,
    left: 8,
    right: 8,
    top: 12,
    bottom: 12,
    padding: 24,
    gap: 14,
    justifyContent: "center" as const,
    backgroundColor: colors.paper,
    borderColor: colors.accent,
    borderWidth: 2,
    borderRadius: 18,
  };

  return (
    <View style={panelStyle}>
      <Text style={{ color: colors.ink, fontSize: 28, textAlign: "center" }}>
        {gameClass.sprite} {gameClass.name}
      </Text>
      {page < 0 ? (
        <StyledText>Waiting for all players to finish their class instructions…</StyledText>
      ) : page === 0 ? (
        <>
          <Text style={{ color: colors.ink, fontSize: 17 }}>
            Support · {getSupportDescription(classId, multiplayer)}
          </Text>
          <Text style={{ color: colors.ink, fontSize: 17 }}>Special · {gameClass.special}</Text>
          <PrimaryButton
            accessibilityLabel="Next class instructions"
            accessibilityRole="button"
            label="Next"
            onPress={onNext}
          />
        </>
      ) : (
        <>
          <Text style={{ color: colors.ink, fontSize: 17 }}>
            Attack game · {gameClass.microgameText}
          </Text>
          <Text style={{ color: colors.ink, fontSize: 20, textAlign: "center" }}>
            Damage: {damage}
          </Text>
          <PrimaryButton
            accessibilityLabel="Practice attack game"
            accessibilityRole="button"
            label="Practice"
            onPress={onPractice}
          />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <NormalButton
              accessibilityLabel="Back to class instructions"
              accessibilityRole="button"
              label="Back"
              onPress={onBack}
            />
            <PrimaryButton
              accessibilityLabel="Start playing"
              accessibilityRole="button"
              label="Start"
              onPress={onStart}
            />
          </View>
        </>
      )}
    </View>
  );
}
