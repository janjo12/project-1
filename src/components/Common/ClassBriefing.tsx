import { StyledText } from "@/components/Common/Displays";
import { MicrogameCircle, MicrogameCircleOutline } from "@/components/Common/MicrogameCircle";
import { PixelSprite } from "@/components/Common/PixelSprite";
import { PlayerAura } from "@/components/Common/PlayerAura";
import { useThemeColors } from "@/components/Common/theme";
import { NormalButton, PrimaryButton } from "@/components/Controls/ActionButton";
import { getGameClass, getSupportDescription, type GameClassId } from "@/game/config/game-classes";
import { getRuneTracerPattern } from "@/game/actions/use-microgame";
import { useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";

type ClassBriefingProps = {
  classId: GameClassId;
  page: number;
  damage: number;
  multiplayer: boolean;
  auraColor?: string;
  microgamesEnabled?: boolean;
  onExit?: () => void;
  onNext: () => void;
  onBack: () => void;
  onPracticeAttack: () => void;
  onPracticeDefense: () => void;
  onStart: () => void;
};

export function ClassBriefing({
  classId,
  page,
  damage,
  multiplayer,
  auraColor,
  microgamesEnabled = true,
  onExit,
  onNext,
  onBack,
  onPracticeAttack,
  onPracticeDefense,
  onStart,
}: ClassBriefingProps) {
  const colors = useThemeColors();
  const { height } = useWindowDimensions();
  const compactLayout = height < 600;
  const [readMore, setReadMore] = useState(false);
  const gameClass = getGameClass(classId);
  const panelStyle = {
    position: "absolute" as const,
    zIndex: 90,
    left: 8,
    right: 8,
    top: 12,
    height: Math.max(0, height - 24),
    padding: compactLayout ? 8 : 12,
    gap: compactLayout ? 4 : 8,
    justifyContent: "center" as const,
    backgroundColor: colors.paper,
    borderColor: colors.accent,
    borderWidth: 2,
    borderRadius: 18,
  };

  return (
    <View testID="class-briefing" style={panelStyle}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "center" }}>
        <View style={{ alignItems: "center", height: 48, justifyContent: "center", position: "relative", width: 48 }}>
          {auraColor ? <PlayerAura color={auraColor} size={48} /> : null}
          <PixelSprite sprite={gameClass.sprite} label={`${gameClass.name} class sprite`} size={compactLayout ? 32 : 40} />
        </View>
        <Text style={{ color: colors.ink, fontSize: compactLayout ? 22 : 28, textAlign: "center" }}>
          {gameClass.name}
        </Text>
      </View>
      {page < 0 ? (
        <StyledText>Waiting for all players to finish their class instructions…</StyledText>
      ) : page === 0 ? (
        <>
          <Text style={{ color: colors.ink, fontSize: compactLayout ? 16 : 19, lineHeight: compactLayout ? 22 : 27, textAlign: "center" }}>
            {gameClass.description}
          </Text>
          {readMore ? <View style={{ gap: 4 }}>
            <Text style={{ color: colors.ink, fontSize: compactLayout ? 13 : 15, textAlign: "center" }}>Support · {getSupportDescription(classId, multiplayer)}</Text>
            <Text style={{ color: colors.ink, fontSize: compactLayout ? 13 : 15, textAlign: "center" }}>Special · {gameClass.special}</Text>
          </View> : null}
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
            {onExit ? <NormalButton accessibilityLabel="Back to setup" accessibilityRole="button" label="Back" onPress={onExit} /> : null}
            <NormalButton accessibilityLabel={readMore ? "Hide class stats" : "Read more about class stats"} accessibilityRole="button" label={readMore ? "Less" : "Read More"} onPress={() => setReadMore(value => !value)} />
          </View>
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
            <NormalButton accessibilityLabel="Continue to practice" accessibilityRole="button" label="Practice" onPress={onNext} />
            <PrimaryButton accessibilityLabel="Start playing" accessibilityRole="button" label="Start" onPress={onStart} />
          </View>
        </>
      ) : (
        <>
          {!compactLayout ? <>
            <Text style={{ color: colors.ink, fontSize: 16, textAlign: "center" }}>Support · {getSupportDescription(classId, multiplayer)}</Text>
            <Text style={{ color: colors.ink, fontSize: 16, textAlign: "center" }}>Special · {gameClass.special}</Text>
          </> : <Text style={{ color: colors.sepia, fontSize: 13, textAlign: "center" }}>Choose a skill to practice, or start playing.</Text>}
          {microgamesEnabled ? (
            <View style={{ alignItems: "center", gap: 8 }}>
              {!compactLayout && gameClass.microgame === "concentration" ? (
                <View style={{ height: 48, width: 104, justifyContent: "center" }}>
                  <MicrogameCircleOutline
                    size={40}
                    style={{ position: "absolute", left: 32 }}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                  <MicrogameCircle
                    size={44}
                    style={{ position: "absolute", left: 30 }}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                </View>
              ) : !compactLayout && gameClass.microgame === "multitap" ? (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <MicrogameCircle size={32} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                  <MicrogameCircle size={32} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                  <MicrogameCircle size={32} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                </View>
              ) : !compactLayout && gameClass.microgame === "multiswipe" ? (
                <View style={{ alignItems: "center", flexDirection: "row", height: 42, justifyContent: "center", width: 126 }}>
                  <MicrogameCircle size={28} style={{ position: "absolute", left: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                  <View style={{ backgroundColor: colors.accent, height: 8, width: 72 }} />
                  <MicrogameCircle size={28} style={{ position: "absolute", right: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
                </View>
              ) : null}
              {!compactLayout && gameClass.microgame === "timed-attack" ? (
                <Text style={{ color: colors.accent, fontSize: 36, fontWeight: "900" }}>NOW!</Text>
              ) : null}
              {!compactLayout && gameClass.microgame === "rune-tracer" ? <RuneTracerPreview /> : null}
              <Text numberOfLines={compactLayout ? 1 : undefined} style={{ color: colors.ink, fontSize: compactLayout ? 13 : 17, textAlign: "center" }}>
                Attack game · {gameClass.microgameText}
              </Text>
            </View>
          ) : (
            <StyledText>Attack microgames are off. Attacks use full damage without timing bonuses.</StyledText>
          )}
          <Text style={{ color: colors.ink, fontSize: compactLayout ? 13 : 17, textAlign: "center" }}>
            {compactLayout ? "Defense · Tap when the thin ring reaches the target gap." : "Defense game · Tap when the thin ring reaches the gap between the two target rings."}
          </Text>
          <Text style={{ color: colors.ink, fontSize: compactLayout ? 15 : 20, textAlign: "center" }}>
            Damage: {damage}
          </Text>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center" }}>
            <NormalButton accessibilityLabel="Practice attack game" accessibilityRole="button" label={compactLayout ? "Attack" : "Practice Attack"} onPress={onPracticeAttack} />
            <NormalButton accessibilityLabel="Practice defense game" accessibilityRole="button" label={compactLayout ? "Defense" : "Practice Defense"} onPress={onPracticeDefense} />
          </View>
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

function RuneTracerPreview() {
  const colors = useThemeColors();
  const width = 180;
  const height = 112;
  const pattern = getRuneTracerPattern(width, height, "right", 16);
  return (
    <View testID="rune-tracer-preview" style={{ height, position: "relative", width }}>
      {pattern.edges.map(edge => {
        const from = pattern.nodes.find(node => node.id === edge.from)!.point;
        const to = pattern.nodes.find(node => node.id === edge.to)!.point;
        const x1 = from.x * width;
        const y1 = from.y * height;
        const x2 = to.x * width;
        const y2 = to.y * height;
        const length = Math.hypot(x2 - x1, y2 - y1);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        return <View key={edge.id} style={{ backgroundColor: colors.accent, borderRadius: 3, height: 6, left: (x1 + x2) / 2 - length / 2, position: "absolute", top: (y1 + y2) / 2 - 3, transform: [{ rotate: `${angle}rad` }], width: length }} />;
      })}
      {pattern.nodes.map(node => <View key={node.id} style={{ position: "absolute", left: node.point.x * width - 8, top: node.point.y * height - 8 }}><MicrogameCircle size={16} /></View>)}
    </View>
  );
}
