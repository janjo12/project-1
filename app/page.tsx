"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GAME_PARAMETERS } from "@/gameparameters";
import { GameLoopTimer, PLAYER_MAX_ENERGY, PLAYER_MAX_HEALTH, runGameLoop, useRunGame } from "@/hooks/run-game-singleplayer";
import { DEFAULT_GAME_SETTINGS, type GameSettings, loadGameSettings, saveGameSettings } from "@/utils/settings-storage";
import { generateRandomSeed } from "@/utils/seed";

type Page = "title" | "setup" | "settings" | "game" | "over";

export default function Home() {
  const router = useRouter();
  const [page, setPage] = useState<Page>("title");
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [score, setScore] = useState(0);
  const [help, setHelp] = useState<string | null>(null);
  useEffect(() => { void loadGameSettings().then((value) => { setSettings(value); setLoaded(true); }); }, []);

  async function update(partial: Partial<GameSettings>) {
    const next = { ...settings, ...partial };
    setSettings(next);
    await saveGameSettings(next);
  }
  async function start() {
    const next = { ...settings, seed: settings.seed.trim() || generateRandomSeed() };
    await update(next);
    setSettings(next);
    setPage("game");
  }
  if (!loaded) return <main className="shell"><p>Loading settings…</p></main>;
  if (page === "game") return <Game settings={settings} onGameOver={(value) => { setScore(value); setPage("over"); }} onExit={() => setPage("title")} />;
  if (page === "over") return <main className="shell"><section className="card"><h1>Game Over</h1><p className="score">Score: {score}</p><button className="primary" onClick={() => setPage("title")}>Return to Title</button></section></main>;

  return <main className="shell"><section className="card">
    <header className="topbar"><button className="quiet" onClick={() => setPage("title")}>{page === "title" ? "" : "← Back"}</button>{page !== "title" && <button className="quiet" onClick={() => setPage("settings")}>⚙ Settings</button>}</header>
    {page === "title" && <><h1>Dungeon Run</h1><p className="lede">Explore a seeded dungeon, fight monsters, and find the stairs.</p><button className="primary" onClick={() => { void update({ seed: generateRandomSeed() }); setPage("setup"); }}>Singleplayer</button><p className="muted">A turn-based dungeon adventure</p></>}
    {page === "setup" && <><h1>Prepare your run</h1><div className="formrow"><label htmlFor="difficulty">Difficulty</label><select id="difficulty" value={settings.difficulty} onChange={(e) => void update({ difficulty: e.target.value as GameSettings["difficulty"] })}><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select><button className="help" onClick={() => setHelp("Easy is a casual experience. Normal adds a turn limit. Hard adds a timer for each turn.")}>?</button></div><div className="formrow"><label htmlFor="seed">Seed</label><input id="seed" placeholder="Random" value={settings.seed} onChange={(e) => void update({ seed: e.target.value })}/><button className="help" onClick={() => setHelp("The seed determines the generated layout for each dungeon level.")}>?</button></div><button className="primary" onClick={() => void start()}>Start Game</button></>}
    {page === "settings" && <><h1>Settings</h1><div className="formrow"><label htmlFor="appearance">Appearance</label><select id="appearance" value={settings.appearance} onChange={(e) => void update({ appearance: e.target.value as GameSettings["appearance"] })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></div><label className="check"><input type="checkbox" checked={settings.vibrationEnabled} onChange={(e) => void update({ vibrationEnabled: e.target.checked })}/> Vibration</label><label className="check"><input type="checkbox" checked={settings.reducedMotion} onChange={(e) => void update({ reducedMotion: e.target.checked })}/> Reduced motion</label><button className="primary" onClick={() => setPage("setup")}>Done</button></>}
    {help && <div className="modal"><div className="modalcard"><p>{help}</p><button className="primary" onClick={() => setHelp(null)}>Got it</button></div></div>}
  </section></main>;
}

function Game({ settings, onGameOver, onExit }: { settings: GameSettings; onGameOver: (score: number) => void; onExit: () => void }) {
  const [paused, setPaused] = useState(false);
  const game = useRunGame({ difficulty: settings.difficulty, onGameOver, seed: settings.seed.trim(), vibrationEnabled: settings.vibrationEnabled });
  const loop = useMemo(() => new GameLoopTimer(), []);
  useEffect(() => {
    loop.start();
    let time = 0;
    const timer = window.setInterval(() => {
      const delta = GAME_PARAMETERS.turn.gameLoopTickMs;
      time += delta;
      runGameLoop({ gameLoop: { elapsed: 0, expired: false, isTurnClockActive: game.isTurnClockActive, onExpire: game.expireTurn, onFrame: game.updateGameFrame, resetKey: game.turnNumber, turnDuration: game.turnDuration } }, { time: { delta, currentTime: time, previousTime: time - delta, previousDelta: delta } } as never);
    }, GAME_PARAMETERS.turn.gameLoopTickMs);
    return () => { window.clearInterval(timer); loop.stop(); };
  }, [game.isTurnClockActive, game.expireTurn, game.turnNumber, game.turnDuration, game.updateGameFrame, loop]);
  function actorPress(actor: (typeof game.roomSceneActors)[number]) {
    if (actor.kind === "enemy") game.attackMonster(actor.id);
    else if (actor.kind === "item") void game.pickupItem();
    else if (actor.kind === "stairs") game.descend();
  }
  const directions = { bottom: "south", left: "west", right: "east", top: "north" } as const;
  const dark = settings.appearance === "dark" || (settings.appearance === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  return <main className={`shell game-shell ${dark ? "dark" : "light"}`}>
    <section className="game-card"><header className="game-header"><strong>Dungeon Run · Level {game.level}</strong><button className="quiet" onClick={() => setPaused(true)}>Menu</button></header>
      <div className="turn-status">{game.turnStatus}</div>
      <p className="hint">Room {game.currentRoomId}</p>
      <div className="game-actions"><div className="item-pill"><b>{game.inventoryItemLabel ?? "No Item"}</b><small>{game.inventoryItemActivationDescription ?? "Pick up an item to hold it."}</small></div><button className="charge" disabled={game.isResolving || game.hasLost || (!game.isCharged && game.playerEnergy < GAME_PARAMETERS.combat.chargeEnergyCost)} onClick={game.toggleCharge}>{game.isCharged ? "Charged ⚡ · Cancel" : "Charge Up ⚡"}<small>Next action · 1 energy</small></button></div>
      <p className="hint">Charge for a stronger attack, full block and counter, or a free movement/action.</p>
      <div className="bars"><Meter label="Health" value={game.playerHealth} max={PLAYER_MAX_HEALTH} color="#ef4444"/><Meter label="Energy" value={game.playerEnergy} max={PLAYER_MAX_ENERGY} color="#22c55e"/>{game.hasTurnTimer && <Meter label="Timer" value={game.turnTimeRemaining} max={game.turnDuration} color="#a855f7"/>}</div>
      <section className="web-room" aria-label="Current room">
        <h2>Room</h2>
        <div className="web-doors">{(Object.keys(directions) as (keyof typeof directions)[]).map((position) => {
          const state = game.roomDoorways[position];
          const enabled = !game.isResolving && !game.hasLost && (state === "open" || (state === "locked" && game.inventoryItem === "key"));
          return state === "wall" ? null : <button key={position} disabled={!enabled} onClick={() => void game.moveToRoom(directions[position])}>{position}: {state === "open" ? "Move" : state}</button>;
        })}</div>
        <button className="defend" disabled={game.isResolving || game.hasLost} onClick={game.defend}>Defend</button>
        <h3>In this room</h3>
        {game.roomSceneActors.length === 0 ? <p className="muted">The room is quiet.</p> : <div className="web-actors">{game.roomSceneActors.map((actor) => <button key={actor.id} disabled={game.isResolving || game.hasLost} onClick={() => actorPress(actor)}><span>{actor.sprite} {actor.label}</span>{actor.kind === "enemy" && <small>{actor.currentHealth}/{actor.maxHealth} health · Attack</small>}{actor.kind === "item" && <small>Pick up item</small>}{actor.kind === "equipment" && <small>Pick up equipment</small>}{actor.kind === "stairs" && <small>Descend</small>}</button>)}</div>}
      </section>
    </section>
    {paused && <div className="modal"><div className="modalcard"><h2>Menu</h2><label className="check"><input type="checkbox" checked={dark} onChange={(e) => { const v = e.target.checked; void saveGameSettings({ ...settings, appearance: v ? "dark" : "light" }); }}/> Dark Mode</label><label className="check"><input type="checkbox" checked={settings.vibrationEnabled} onChange={(e) => void saveGameSettings({ ...settings, vibrationEnabled: e.target.checked })}/> Vibration</label><button className="primary" onClick={() => setPaused(false)}>Back to Game</button><button className="danger" onClick={() => { setPaused(false); onExit(); }}>Quit to Title</button></div></div>}
  </main>;
}

function Meter({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return <div className="meter"><span>{label}</span><div className="track"><i style={{ width: `${Math.max(0, Math.min(100, 100 * value / Math.max(max, 1)))}%`, background: color }}/></div><b>{Math.ceil(value / 100) || value}</b></div>;
}
