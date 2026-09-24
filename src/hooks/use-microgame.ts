import { useCallback, useEffect, useRef, useState } from "react";

export type MicrogameKind = "concentration" | "timed-attack" | "multitap";
export const MICROGAME_MAX_DURATION_MS = 1500;
const now = () => globalThis.performance?.now?.() ?? Date.now();
const scoreWithinRange = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

export function getConcentrationScore(actualMs: number, targetMs: number) {
  return scoreWithinRange(100 - Math.abs(actualMs - targetMs) * 100 / 500);
}

export function getTimedAttackScore(actualMs: number) {
  const base = scoreWithinRange(100 - Math.abs(actualMs - 250) * 100 / 500);
  return actualMs < 250 ? Math.floor(base / 2) : base;
}

export function getMultitapScore(clicks: number) {
  return scoreWithinRange(clicks * 10);
}

export function useMicrogame(onComplete: (score: number) => void) {
  const [active, setActive] = useState(false);
  const [kind, setKind] = useState<MicrogameKind>("concentration");
  const [elapsed, setElapsed] = useState(0);
  const [targetDelay, setTargetDelay] = useState(500);
  const [targetSpot, setTargetSpot] = useState(0.76);
  const [clicks, setClicks] = useState(0);
  const startedAt = useRef(0);
  const leftHandedRef = useRef(false);
  const nowRef = useRef(now);
  const completed = useRef(false);
  const finish = useCallback((score: number) => {
    if (completed.current) return;
    completed.current = true;
    setActive(false);
    onComplete(scoreWithinRange(score));
  }, [onComplete]);
  const start = useCallback(
    (gameKind: MicrogameKind = "concentration", handedness: "left" | "right" = "right") => {
      completed.current = false;
      setKind(gameKind);
      setElapsed(0);
      setClicks(0);
      setTargetDelay(200 + Math.floor(Math.random() * 401));
      leftHandedRef.current = handedness === "left";
      setTargetSpot(handedness === "right" ? 0.24 : 0.76);
      startedAt.current = nowRef.current();
      setActive(true);
    },
    [],
  );
  const tap = useCallback(() => {
    if (!active || completed.current) return;
    const elapsedMs = nowRef.current() - startedAt.current;
    if (kind === "multitap") {
      const next = clicks + 1;
      setClicks(next);
      setTargetSpot(leftHandedRef.current ? 0.58 + Math.random() * 0.32 : 0.1 + Math.random() * 0.32);
      if (next >= 10) finish(100);
      return;
    }
    const targetProgress = leftHandedRef.current ? (targetSpot - 0.1) / 0.8 : (0.9 - targetSpot) / 0.8;
    const score = kind === "concentration"
      ? getConcentrationScore(elapsedMs, targetProgress * MICROGAME_MAX_DURATION_MS)
      : getTimedAttackScore(elapsedMs - targetDelay);
    finish(score);
  }, [active, clicks, finish, kind, targetDelay, targetSpot]);
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      const value = Math.min(MICROGAME_MAX_DURATION_MS, nowRef.current() - startedAt.current);
      setElapsed(value);
      if (value >= MICROGAME_MAX_DURATION_MS) {
        finish(kind === "multitap" ? getMultitapScore(clicks) : 0);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [active, clicks, finish, kind]);
  return { active, kind, elapsed, targetDelay, targetSpot, clicks, start, tap };
}
