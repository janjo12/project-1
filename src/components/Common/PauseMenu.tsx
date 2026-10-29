import { useState } from "react";
import { ScrollView, useWindowDimensions } from "react-native";

import { Container, Row, StyledModal, StyledText, Title } from "@/components/Common/Displays";
import { DestructiveButton, NormalButton, PrimaryButton, SegmentedButton, ToggleButton } from "@/components/Controls/ActionButton";
import { getSpecialDescription, getSupportDescription, type GameClassId } from "@/game/config/game-classes";
import type { GameSettings } from "@/utils/settings-storage";

export type PauseMenuProps = {
  onBackToGame: () => void;
  onQuitToTitle: () => void;
  onPractice: () => void;
  onPracticeRuneTracer: () => void;
  onOpenMap?: () => void;
  onSettingsChange: (settings: Partial<GameSettings>) => void;
  microgamesEnabled: boolean;
  level: number;
  classId: GameClassId;
  microgameAverage: number | null;
  settings: GameSettings;
  seed: string;
  visible: boolean;
};

export function PauseMenu({
  onBackToGame,
  onQuitToTitle,
  onPractice,
  onPracticeRuneTracer,
  onOpenMap,
  onSettingsChange,
  microgamesEnabled,
  level,
  classId,
  microgameAverage,
  settings,
  seed,
  visible,
}: PauseMenuProps) {
  const [showInstructions, setShowInstructions] = useState(false);
  const tinyLayout = useWindowDimensions().height < 500;
  return (
    <StyledModal
      accessibilityLabel="Game menu"
      accessibilityRole="dialog"
      animationType="fade"
      onRequestClose={onBackToGame}
      visible={visible}
    >
      <Title>{showInstructions ? "Instructions" : "Menu"}</Title>
      {!showInstructions ? <StyledText>Seed: {seed}</StyledText> : null}

      {showInstructions ? <ScrollView style={{ maxHeight: "70%" }} contentContainerStyle={{ alignItems: "stretch", gap: 10 }}>
        <StyledText>Level {level}</StyledText>
        <StyledText>Tap a monster to attack. Tap an item or equipment in the room to pick it up. Use doorways to move, tap your hero for the class support skill, and tap the stairs to descend.</StyledText>
        <StyledText>{getSupportDescription(classId, false)}</StyledText>
        <StyledText>{getSpecialDescription(classId)}</StyledText>
        <StyledText>When an enemy attacks, tap when BLOCK! appears. Better timing reduces the damage you take.</StyledText>
        <StyledText>Each action advances the turn and lets enemies act. On timed difficulties, the turn timer also limits how long you have to choose. Hard runs also have a turn budget; Easy has no run-wide turn deadline.</StyledText>
        <StyledText>Charge Up spends Energy to strengthen your next attack, block and counter the next hit, or move and pick up loot without spending a turn. Tap it again to cancel and refund the Energy.</StyledText>
        <StyledText>Items activate automatically when their condition is met. Picking up a replacement drops the item you carry in the current room. Equipment stays active while carried; replacing it or choosing Drop Equipment leaves it in the current room.</StyledText>
        <StyledText>Clearing a floor and taking its stairs restores Health and Energy. Your item and equipment carry over to the next floor.</StyledText>
        <StyledText>Running microgame average: {microgameAverage === null ? "No scores yet" : `${Math.round(microgameAverage)}% of maximum score`}</StyledText>
        <PrimaryButton accessibilityLabel="Back to pause menu" accessibilityRole="button" label="Back" onPress={() => setShowInstructions(false)} />
      </ScrollView> : <>
        <Container style={tinyLayout ? { gap: 6 } : undefined}>
          <Row>
            <StyledText>Appearance</StyledText>
            <SegmentedButton
              onChange={(appearance) => onSettingsChange({ appearance: appearance.toLowerCase() as typeof settings.appearance })}
              options={["System", "Light", "Dark"] as const}
              value={settings.appearance[0].toUpperCase() + settings.appearance.slice(1)}
            />
          </Row>
          <ToggleButton label="Vibration" value={settings.vibrationEnabled} onValueChange={value => onSettingsChange({ vibrationEnabled: value })} />
          <ToggleButton label="Left-handed controls" value={settings.handedness === "left"} onValueChange={value => onSettingsChange({ handedness: value ? "left" : "right" })} />
        </Container>
        {onOpenMap ? <NormalButton accessibilityLabel="Open dungeon map" accessibilityRole="button" label="Dungeon Map" onPress={onOpenMap} /> : null}
        <NormalButton accessibilityLabel="Open instructions" accessibilityRole="button" label="Instructions" onPress={() => setShowInstructions(true)} />
        {microgamesEnabled ? <NormalButton accessibilityLabel="Practice attack microgame" accessibilityRole="button" label="Practice Attack" onPress={onPractice} /> : null}
        {microgamesEnabled ? <NormalButton accessibilityLabel="Practice Rune Tracer microgame" accessibilityRole="button" label="Practice Rune Tracer" onPress={onPracticeRuneTracer} /> : null}
        <PrimaryButton accessibilityLabel="Back to Game" accessibilityRole="button" label="Back to Game" onPress={onBackToGame} />
        <DestructiveButton accessibilityLabel="Quit to Title" accessibilityRole="button" label="Quit to Title" onPress={onQuitToTitle} />
      </>}
    </StyledModal>
  );
}
