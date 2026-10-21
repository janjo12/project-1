"use client";

import { useState, type PropsWithChildren } from "react";
import { View } from "react-native";

import { Container, StyledText, Title } from "@/components/Common/Displays";
import { MultiplayerScreen } from "@/components/Common/MultiplayerScreen";
import { ScreenShell } from "@/components/Common/ScreenShell";
import { ThemeProvider } from "@/components/Common/theme";
import { PrimaryButton } from "@/components/Controls/ActionButton";
import { useGameSettings } from "@/hooks/use-game-settings";
import { generateRandomSeed } from "@/utils/seed";
import { SettingsScreen, SetupScreen, SingleplayerScreen } from "./RunScreens";
type Page = "title" | "setup" | "settings" | "game" | "multiplayer" | "over";
type PlayMode = "singleplayer" | "multiplayer";

export default function Home() {
  const { isLoading, settings, updateSettings, saveSettings } = useGameSettings();
  const [page, setPage] = useState<Page>("title");
  const [mode, setMode] = useState<PlayMode>("singleplayer");
  const [score, setScore] = useState(0);

  if (isLoading) {
    return <Preview><ThemeProvider appearance={settings.appearance}><ScreenShell><StyledText>Loading…</StyledText></ScreenShell></ThemeProvider></Preview>;
  }

  const goToSetup = (nextMode: PlayMode) => {
    setMode(nextMode);
    updateSettings({ seed: generateRandomSeed() });
    setPage("setup");
  };

  return (
    <Preview>
      <ThemeProvider appearance={settings.appearance}>
        {page === "title" ? (
          <ScreenShell>
            <View style={{ flex: 1, justifyContent: "center", gap: 24, width: "100%" }}>
              <View style={{ alignItems: "center", gap: 16 }}>
                <Title>[Project 1]</Title>
                <StyledText style={{ textAlign: "center" }}>How would you like to play?</StyledText>
              </View>
              <View style={{ gap: 16, width: "100%" }}>
                <PrimaryButton accessibilityLabel="Singleplayer" accessibilityRole="button" label="Singleplayer" onPress={() => goToSetup("singleplayer")} />
                <PrimaryButton accessibilityLabel="Multiplayer" accessibilityRole="button" label="Multiplayer" onPress={() => goToSetup("multiplayer")} />
              </View>
            </View>
          </ScreenShell>
        ) : null}

        {page === "setup" ? (
          <SetupScreen
            settings={settings}
            onBack={() => setPage("title")}
            onSettings={() => setPage("settings")}
            onUpdate={updateSettings}
            onStart={async () => {
              const next = { ...settings, seed: settings.seed.trim() || generateRandomSeed() };
              await saveSettings(next);
              setPage(mode === "multiplayer" ? "multiplayer" : "game");
            }}
          />
        ) : null}

        {page === "settings" ? (
          <SettingsScreen settings={settings} onBack={() => setPage("setup")} onUpdate={updateSettings} />
        ) : null}

        {page === "game" && mode === "singleplayer" ? (
          <SingleplayerScreen
            settings={settings}
            onSettingsChange={updateSettings}
            onGameOver={value => { setScore(value); setPage("over"); }}
            onExit={() => setPage("title")}
          />
        ) : null}

        {page === "multiplayer" ? (
          <MultiplayerScreen settings={settings} onLeave={() => setPage("title")} />
        ) : null}

        {page === "over" ? (
          <ScreenShell>
            <Container>
              <Title>Game Over</Title>
              <Title>Score: {score}</Title>
              <PrimaryButton accessibilityLabel="Return to Title" accessibilityRole="button" label="Return to Title" onPress={() => setPage("title")} />
            </Container>
          </ScreenShell>
        ) : null}
      </ThemeProvider>
    </Preview>
  );
}

function Preview({ children }: PropsWithChildren) {
  return <div className="phone-preview">{children}</div>;
}
