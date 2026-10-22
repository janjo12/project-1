import { expect, test } from "@playwright/test";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";

test("the player reaches the exit before the room changes and enters from the opposite doorway", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 });
  const startTime = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: startTime });
  await page.clock.pauseAt(new Date(startTime.getTime() + 1_000));
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "Singleplayer" }).click();
  await page.getByRole("button", { name: "easy", exact: true }).click();
  await page.getByRole("textbox", { name: "Seed" }).fill("testwarrior");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Next class instructions", exact: true }).click();
  await page.getByRole("button", { name: "Start playing", exact: true }).click();
  await page.clock.runFor(GAME_PARAMETERS.animation.roomTransitionDurationMs);

  const currentRoom = page.getByTestId("current-dungeon-room");
  const startingRoom = (await currentRoom.getAttribute("aria-label"))?.match(/Room ([A-F](?:1[0-2]|[1-9]))/)?.[1];
  expect(startingRoom).toBeTruthy();
  const doorway = page.getByRole("button", { name: /^Tap (top|right|bottom|left) doorway to move$/ }).first();
  const direction = (await doorway.getAttribute("aria-label"))?.match(/^Tap (top|right|bottom|left)/)?.[1];
  expect(direction).toBeTruthy();
  const player = page.getByTestId("local-player-actor");
  const startingBounds = await player.boundingBox();
  expect(startingBounds).not.toBeNull();

  await doorway.click();
  expect(await player.evaluate(element => getComputedStyle(element).transitionDuration)).toContain("0.18s");
  await page.clock.runFor(GAME_PARAMETERS.animation.roomExitDurationMs / 2);
  expect((await currentRoom.getAttribute("aria-label"))?.match(/Room ([A-F](?:1[0-2]|[1-9]))/)?.[1]).toBe(startingRoom);
  const halfwayBounds = await player.boundingBox();
  expect(halfwayBounds).not.toBeNull();
  if (direction === "top") expect(halfwayBounds!.y).toBeLessThan(startingBounds!.y);
  if (direction === "bottom") expect(halfwayBounds!.y).toBeGreaterThan(startingBounds!.y);
  if (direction === "left") expect(halfwayBounds!.x).toBeLessThan(startingBounds!.x);
  if (direction === "right") expect(halfwayBounds!.x).toBeGreaterThan(startingBounds!.x);

  await page.clock.runFor(GAME_PARAMETERS.animation.roomExitDurationMs / 2);
  const nextRoom = (await page.getByTestId("current-dungeon-room").getAttribute("aria-label"))?.match(/Room ([A-F](?:1[0-2]|[1-9]))/)?.[1];
  expect(nextRoom).toBeTruthy();
  expect(nextRoom).not.toBe(startingRoom);
  const entryAnimation = page.getByTestId("player-room-entry-animation");
  await expect(entryAnimation).toBeVisible();

  const entryAnimationStyle = await entryAnimation.evaluate(element => {
    const style = getComputedStyle(element);
    const effect = element.getAnimations()[0]?.effect as KeyframeEffect | null;
    const keyframes = effect?.getKeyframes();
    return {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      fromTransform: keyframes?.[0]?.transform,
      toTransform: keyframes?.[keyframes.length - 1]?.transform,
    };
  });
  expect(entryAnimationStyle.animationName).not.toBe("none");
  expect(entryAnimationStyle.animationDuration).toBe("0.18s");
  expect(entryAnimationStyle.toTransform).toContain("translateX(0px)");
  expect(entryAnimationStyle.toTransform).toContain("translateY(0px)");
  const expectedEntryOffset = direction === "top" ? "translateY(22px)"
    : direction === "bottom" ? "translateY(-22px)"
      : direction === "left" ? "translateX(22px)"
        : "translateX(-22px)";
  expect(entryAnimationStyle.fromTransform).toContain(expectedEntryOffset);
});
