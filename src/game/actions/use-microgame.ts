import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { createNumberStore } from "@/game/state/numberStore";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import type { Difficulty } from "@/utils/settings-storage";

export type MicrogameKind = "concentration" | "timed-attack" | "multitap";
export type MicrogameOptions = { difficulty?: Difficulty; level?: number };
export const HUMAN_REACTION_WINDOW_MS = 250;
export const MICROGAME_MAX_DURATION_MS = 1500;
export const CONCENTRATION_TARGET_DURATION_MS = MICROGAME_MAX_DURATION_MS;
export const TIMED_ATTACK_CUE_DELAY_MS = 1000;
export const TIMED_ATTACK_WINDOW_MS = TIMED_ATTACK_CUE_DELAY_MS + HUMAN_REACTION_WINDOW_MS + 500;
export const MULTITAP_WINDOW_MS = 3000;
const now = () => globalThis.performance?.now?.() ?? Date.now();
const scoreWithinRange = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

export function getConcentrationScore(actualMs: number, targetMs: number) {
  // Score falls linearly with timing error and is clamped to the shared 0–100 range.
  return scoreWithinRange(100 - Math.abs(actualMs - targetMs) * 100 / 500);
}

export function getTimedAttackScore(actualMs: number) {
  // Score is measured from the visible cue; a 250 ms human reaction is the perfect response.
  return scoreWithinRange(100 - Math.abs(actualMs - HUMAN_REACTION_WINDOW_MS) * 100 / 500);
}

export function getMultitapTargetTaps(difficulty: Difficulty, level: number) {
  const levelSteps = Math.floor(Math.max(0, level - 1) / GAME_PARAMETERS.microgame.multitapTapsPerLevel);
  return GAME_PARAMETERS.microgame.multitapBaseTaps +
    GAME_PARAMETERS.microgame.multitapDifficultyBonus[difficulty] + levelSteps;
}

export function getMultitapScore(clicks: number, targetTaps: number) {
  return scoreWithinRange(clicks * 100 / Math.max(1, targetTaps));
}

export function useMicrogame(onComplete: (score: number) => void) {
  const [active, setActive] = useState(false);
  const [kind, setKind] = useState<MicrogameKind>("concentration");
  const [elapsedStore] = useState(() => createNumberStore(0));
  const [targetDelay, setTargetDelay] = useState(500);
  const [targetTaps, setTargetTaps] = useState(() => getMultitapTargetTaps("normal", 1));
  const [targetSpot, setTargetSpot] = useState(0.76);
  const startedAt = useRef(0);
  const leftHandedRef = useRef(false);
  const nowRef = useRef(now);
  const completed = useRef(false);
  const clickCount = useRef(0);
  const onCompleteRef = useRef(onComplete);
  useLayoutEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  const finish = useCallback((score: number) => {
    // A single completion guard prevents tap/timeout races from submitting twice.
    if (completed.current) return;
    completed.current = true;
    setActive(false);
    onCompleteRef.current(scoreWithinRange(score));
  }, []);
  const start = useCallback(
    (gameKind: MicrogameKind = "concentration", handedness: "left" | "right" = "right", options?: MicrogameOptions) => {
      completed.current = false;
      setKind(gameKind);
      elapsedStore.setSnapshot(0);
      clickCount.current = 0;
      setTargetDelay(gameKind === "timed-attack" ? TIMED_ATTACK_CUE_DELAY_MS : 200 + Math.floor(Math.random() * 401));
      setTargetTaps(getMultitapTargetTaps(options?.difficulty ?? "normal", options?.level ?? 1));
      leftHandedRef.current = handedness === "left";
      setTargetSpot(handedness === "right" ? 0.24 : 0.76);
      startedAt.current = nowRef.current();
      setActive(true);
    },
    [elapsedStore],
  );
  const tap = useCallback(() => {
    if (!active || completed.current) return;
    const elapsedMs = nowRef.current() - startedAt.current;
    if (kind === "multitap") {
      const next = clickCount.current + 1;
      clickCount.current = next;
      setTargetSpot(leftHandedRef.current ? 0.58 + ((next * 0.137) % 0.32) : 0.1 + ((next * 0.137) % 0.32));
      if (next >= targetTaps) finish(getMultitapScore(next, targetTaps));
      return;
    }
    const targetProgress = leftHandedRef.current ? (targetSpot - 0.1) / 0.8 : (0.9 - targetSpot) / 0.8;
    const score = kind === "concentration"
      ? getConcentrationScore(elapsedMs, targetProgress * CONCENTRATION_TARGET_DURATION_MS)
      : getTimedAttackScore(elapsedMs - targetDelay);
    finish(score);
  }, [active, finish, kind, targetDelay, targetSpot, targetTaps]);
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      const duration = getMicrogameWindow(kind);
      const value = Math.min(duration, nowRef.current() - startedAt.current);
      elapsedStore.setSnapshot(value);
      if (value >= duration) {
        finish(kind === "multitap" ? getMultitapScore(clickCount.current, targetTaps) : 0);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [active, elapsedStore, finish, kind, targetTaps]);
  return {
    active,
    kind,
    get elapsed() { return elapsedStore.getSnapshot(); },
    elapsedStore,
    targetDelay,
    targetSpot,
    start,
    tap,
  };
}

export function getMicrogameWindow(kind: MicrogameKind) {
  if (kind === "timed-attack") return TIMED_ATTACK_WINDOW_MS;
  if (kind === "multitap") return MULTITAP_WINDOW_MS;
  return MICROGAME_MAX_DURATION_MS;
}
