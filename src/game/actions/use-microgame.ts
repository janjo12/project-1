import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { createNumberStore } from "@/game/state/numberStore";

export type MicrogameKind = "concentration" | "timed-attack" | "multitap";
export type MicrogameOptions = { istest?: boolean };
export const HUMAN_REACTION_WINDOW_MS = 250;
export const MICROGAME_MAX_DURATION_MS = 1500;
export const CONCENTRATION_TARGET_DURATION_MS = MICROGAME_MAX_DURATION_MS - HUMAN_REACTION_WINDOW_MS;
export const TIMED_ATTACK_CUE_DELAY_MS = 1000;
export const TIMED_ATTACK_WINDOW_MS = TIMED_ATTACK_CUE_DELAY_MS + HUMAN_REACTION_WINDOW_MS + 500;
export const MULTITAP_WINDOW_MS = 10 * (HUMAN_REACTION_WINDOW_MS + 150) + 500;
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

export function getMultitapScore(clicks: number) {
  // Each tap is worth ten points, capped by the common score clamp.
  return scoreWithinRange(clicks * 10);
}

export function useMicrogame(onComplete: (score: number) => void) {
  const [active, setActive] = useState(false);
  const [kind, setKind] = useState<MicrogameKind>("concentration");
  const [elapsedStore] = useState(() => createNumberStore(0));
  const [targetDelay, setTargetDelay] = useState(500);
  const [targetSpot, setTargetSpot] = useState(0.76);
  const [istest, setIsTest] = useState(false);
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
      setIsTest(options?.istest ?? false);
      completed.current = false;
      setKind(gameKind);
      elapsedStore.setSnapshot(0);
      clickCount.current = 0;
      setTargetDelay(gameKind === "timed-attack" ? TIMED_ATTACK_CUE_DELAY_MS : 200 + Math.floor(Math.random() * 401));
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
      if (next >= 10) finish(100);
      return;
    }
    const targetProgress = leftHandedRef.current ? (targetSpot - 0.1) / 0.8 : (0.9 - targetSpot) / 0.8;
    const score = kind === "concentration"
      ? getConcentrationScore(elapsedMs - HUMAN_REACTION_WINDOW_MS, targetProgress * CONCENTRATION_TARGET_DURATION_MS)
      : getTimedAttackScore(elapsedMs - targetDelay);
    finish(score);
  }, [active, finish, kind, targetDelay, targetSpot]);
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      const duration = getMicrogameWindow(kind);
      const value = Math.min(duration, nowRef.current() - startedAt.current);
      elapsedStore.setSnapshot(value);
      if (value >= duration) {
        finish(kind === "multitap" ? getMultitapScore(clickCount.current) : 0);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [active, elapsedStore, finish, kind]);
  return {
    active,
    kind,
    get elapsed() { return elapsedStore.getSnapshot(); },
    elapsedStore,
    targetDelay,
    targetSpot,
    get clicks() { return clickCount.current; },
    istest,
    start,
    tap,
  };
}

export function getMicrogameWindow(kind: MicrogameKind) {
  if (kind === "timed-attack") return TIMED_ATTACK_WINDOW_MS;
  if (kind === "multitap") return MULTITAP_WINDOW_MS;
  return MICROGAME_MAX_DURATION_MS;
}
