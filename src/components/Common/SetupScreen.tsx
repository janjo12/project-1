"use client";

import { useState } from "react";
import { useWindowDimensions } from "react-native";

import { Container, Footer, Header, Row, StyledText, Title } from "@/components/Common/Displays";
import { InformationPopup } from "@/components/Common/InformationPopup";
import { ScreenShell } from "@/components/Common/ScreenShell";
import { HelpButton, NormalButton, PrimaryButton, SegmentedButton, TextEntry, ToggleButton } from "@/components/Controls/ActionButton";
import type { GameSettings } from "@/utils/settings-storage";

export function SetupScreen({
  settings,
  onBack,
  onSettings,
  onUpdate,
  onStart,
  showSeed = true,
  showBack = true,
  showSettings = true,
  shell = true,
  startLabel = "Start",
  startDisabled = false,
}: {
  settings: GameSettings;
  onBack: () => void;
  onSettings: () => void;
  onUpdate: (settings: Partial<GameSettings>) => void;
  onStart: () => void;
  showSeed?: boolean;
  showBack?: boolean;
  showSettings?: boolean;
  shell?: boolean;
  startLabel?: string;
  startDisabled?: boolean;
}) {
  const [helpTopic, setHelpTopic] = useState<"difficulty" | "seed" | null>(null);
  const compactLayout = useWindowDimensions().height < 500;
  const helpContent = helpTopic === "difficulty"
    ? { title: "Difficulty", body: "Choose Easy for a casual experience. Normal requires you to beat each level in a limited number of turns. Hard keeps that turn limit and adds a timer for every turn." }
    : helpTopic === "seed" ? { title: "Seed", body: "Used for determining the random layout of each level." } : null;

  const content = (
    <>
      <Container style={compactLayout ? { gap: 4, paddingBottom: 0, paddingTop: 0 } : undefined}>
        {showBack || showSettings ? (
          <Header>
            {showBack ? <NormalButton accessibilityLabel="Back" accessibilityRole="button" label="Back" onPress={onBack} /> : null}
            {showSettings ? <NormalButton accessibilityLabel="Settings" accessibilityRole="button" icon="cog" onPress={onSettings} /> : null}
          </Header>
        ) : null}
        <Title>Dungeon Run</Title>
        <Container style={compactLayout ? { gap: 4, paddingBottom: 0, paddingTop: 0 } : undefined}>
          <Row>
            <StyledText>Difficulty</StyledText>
            <SegmentedButton onChange={difficulty => onUpdate({ difficulty })} options={["easy", "normal", "hard"] as const} value={settings.difficulty} />
            <HelpButton accessibilityLabel="Difficulty help" accessibilityRole="button" onPress={() => setHelpTopic("difficulty")} />
          </Row>
          <ToggleButton label="Attack microgames" value={settings.microgamesEnabled} onValueChange={microgamesEnabled => onUpdate({ microgamesEnabled })} />
          <StyledText>Turn off for direct attacks without a timing game.</StyledText>
          <ToggleButton label="Left-handed controls" value={settings.handedness === "left"} onValueChange={value => onUpdate({ handedness: value ? "left" : "right" })} />
          {showSeed ? (
            <Row>
              <StyledText>Seed</StyledText>
              <TextEntry accessibilityLabel="Seed" accessibilityRole="textbox" onChangeText={seed => onUpdate({ seed })} placeholder="Random" value={settings.seed} />
              <HelpButton accessibilityLabel="Seed help" accessibilityRole="button" onPress={() => setHelpTopic("seed")} />
            </Row>
          ) : null}
        </Container>
        <Footer>
          <PrimaryButton accessibilityLabel={startLabel} accessibilityRole="button" label={startLabel} disabled={startDisabled} onPress={onStart} />
        </Footer>
      </Container>
      <InformationPopup visible={helpContent !== null} title={helpContent?.title ?? "Help"} messages={helpContent ? [helpContent.body] : []} dialogAccessibilityLabel={helpContent ? `${helpContent.title} help` : "Help"} onClose={() => setHelpTopic(null)} />
    </>
  );
  return shell ? <ScreenShell compact={compactLayout}>{content}</ScreenShell> : content;
}
