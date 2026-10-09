"use client";

import { useState, type PropsWithChildren } from "react";

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
            <Container>
              <Title>[Project 1]</Title>
              <StyledText>How would you like to play?</StyledText>
              <PrimaryButton accessibilityLabel="Singleplayer" accessibilityRole="button" label="Singleplayer" onPress={() => goToSetup("singleplayer")} />
              <PrimaryButton accessibilityLabel="Multiplayer · Same Wi-Fi" accessibilityRole="button" label="Multiplayer · Same Wi-Fi" onPress={() => goToSetup("multiplayer")} />
              <StyledText>Multiplayer: explore a shared dungeon, with one character on each device.</StyledText>
            </Container>
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
