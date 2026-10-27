import { expect, test } from "@playwright/test";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { openScenarioApp } from "../helpers";

test("the player reaches the exit before the room changes and enters from the opposite doorway", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 900 });
  const startTime = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: startTime });
  await page.clock.pauseAt(new Date(startTime.getTime() + 1_000));
  await openScenarioApp(page, true);

  await page.getByRole("button", { name: "Singleplayer" }).click();
  await page.getByRole("button", { name: "easy", exact: true }).click();
  await page.getByRole("textbox", { name: "Seed" }).fill("testwarrior");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(GAME_PARAMETERS.animation.roomTransitionDurationMs);

  const currentRoom = page.getByTestId("current-dungeon-room");
  const startingRoom = (await currentRoom.getAttribute("aria-label"))?.match(/Room ([A-F](?:1[0-2]|[1-9]))/)?.[1];
  expect(startingRoom).toBeTruthy();
  const doorway = page.getByRole("button", { name: /^Tap (top|right|bottom|left) doorway to move$/ }).first();
  const direction = (await doorway.getAttribute("aria-label"))?.match(/^Tap (top|right|bottom|left)/)?.[1];
  expect(direction).toBeTruthy();
  await expect(doorway).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const doorwayBounds = await doorway.boundingBox();
  expect(doorwayBounds).not.toBeNull();
  expect(Math.min(doorwayBounds!.width, doorwayBounds!.height)).toBeGreaterThan(40);
  const roomFrameBounds = await page.getByTestId("dungeon-room-frame").boundingBox();
  expect(roomFrameBounds).not.toBeNull();
  const horizontalCenter = doorwayBounds!.x + doorwayBounds!.width / 2;
  const verticalCenter = doorwayBounds!.y + doorwayBounds!.height / 2;
  if (direction === "top" || direction === "bottom") {
    expectWithinOnePixel(horizontalCenter, roomFrameBounds!.x + roomFrameBounds!.width / 2);
  } else {
    expectWithinOnePixel(verticalCenter, roomFrameBounds!.y + roomFrameBounds!.height / 2);
  }
  const player = page.getByTestId("local-player-actor");
  const startingBounds = await player.boundingBox();
  const playerSprite = player.getByTestId("pixel-sprite-image");
  const startingSpriteBounds = await playerSprite.boundingBox();
  expect(startingBounds).not.toBeNull();
  expect(startingSpriteBounds).not.toBeNull();
  await page.evaluate(() => {
    (window as any).__playerSpriteImage = document.querySelector('[data-testid="local-player-actor"] [data-testid="pixel-sprite-image"]');
  });

  await doorway.click();
  const exitAnimation = page.getByTestId("player-room-exit-animation");
  await expect(exitAnimation).toBeVisible();
  const exitKeyframes = await exitAnimation.evaluate(element => {
    const effect = element.getAnimations()[0]?.effect as KeyframeEffect | null;
    return effect?.getKeyframes();
  });
  expect(exitKeyframes?.length).toBeGreaterThan(1);
  expect(await player.evaluate(element => getComputedStyle(element).transitionDuration)).toContain("0.25s");
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
  await expect(page.getByTestId("room-transition-snapshot")).toHaveCount(0);
  const entryAnimation = page.getByTestId("player-room-entry-animation");
  await expect(entryAnimation).toBeVisible();
  const incomingSnapshot = page.getByTestId("room-incoming-snapshot");
  const incomingFade = await incomingSnapshot.evaluate(element => {
    const style = getComputedStyle(element);
    const animation = element.getAnimations()[0];
    const effect = animation?.effect as KeyframeEffect | null;
    return {
      opacity: Number(style.opacity),
      duration: effect?.getTiming().duration,
      keyframes: effect?.getKeyframes().map(frame => Number(frame.opacity)),
    };
  });
  expect(incomingFade.duration).toBe(GAME_PARAMETERS.animation.roomTransitionDurationMs);
  expect(incomingFade.duration).toBeGreaterThan(GAME_PARAMETERS.animation.roomExitDurationMs);
  expect(incomingFade.keyframes?.[0]).toBe(0);
  expect(incomingFade.keyframes?.[incomingFade.keyframes.length - 1]).toBe(1);
  const incomingSpritesLoaded = await incomingSnapshot.getByTestId("pixel-sprite-image").evaluateAll(images =>
    images.every(wrapper => {
      const image = wrapper.querySelector("img");
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
    }),
  );
  expect(incomingSpritesLoaded).toBe(true);

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
  const entryPositionTransition = await player.evaluate(element => getComputedStyle(element).transitionProperty);
  expect(entryPositionTransition).not.toContain("left");
  expect(entryPositionTransition).not.toContain("top");
  const roomFrame = await page.getByTestId("dungeon-room-frame").boundingBox();
  const entryBounds = await player.boundingBox();
  const entrySpriteBounds = await playerSprite.boundingBox();
  expect(roomFrame).not.toBeNull();
  expect(entryBounds).not.toBeNull();
  expect(entrySpriteBounds).not.toBeNull();
  expectWithinOnePixel(entrySpriteBounds!.width, startingSpriteBounds!.width);
  expectWithinOnePixel(entrySpriteBounds!.height, startingSpriteBounds!.height);
  const entryX = entryBounds!.x - roomFrame!.x;
  const entryY = entryBounds!.y - roomFrame!.y;
  if (direction === "right") expect(entryX).toBeLessThan(roomFrame!.width * 0.35);
  if (direction === "left") expect(entryX).toBeGreaterThan(roomFrame!.width * 0.55);
  if (direction === "top") expect(entryY).toBeGreaterThan(roomFrame!.height * 0.55);
  if (direction === "bottom") expect(entryY).toBeLessThan(roomFrame!.height * 0.35);
  const neighborRoom = adjacentRoom(startingRoom!, direction!);
  const mapDirection = ({ top: "north", right: "east", bottom: "south", left: "west" } as const)[direction as "top" | "right" | "bottom" | "left"];
  const firstCorridor = await page.getByTestId(`map-corridor-${startingRoom}-${mapDirection}`).boundingBox();
  const oppositeDoor = ({ north: "south", east: "west", south: "north", west: "east" } as const)[mapDirection];
  const neighborCorridor = await page.getByTestId(`map-corridor-${neighborRoom}-${oppositeDoor}`).boundingBox();
  const firstCell = await page.getByTestId(`map-cell-${startingRoom}`).boundingBox();
  const neighborCell = await page.getByTestId(`map-cell-${neighborRoom}`).boundingBox();
  expect(firstCorridor).not.toBeNull();
  expect(neighborCorridor).not.toBeNull();
  expect(firstCell).not.toBeNull();
  expect(neighborCell).not.toBeNull();
  if (direction === "right") {
    expectWithinOnePixel(firstCorridor!.x + firstCorridor!.width, firstCell!.x + firstCell!.width);
    expectWithinOnePixel(neighborCorridor!.x, neighborCell!.x);
  }
  if (direction === "left") {
    expectWithinOnePixel(firstCorridor!.x, firstCell!.x);
    expectWithinOnePixel(neighborCorridor!.x + neighborCorridor!.width, neighborCell!.x + neighborCell!.width);
  }
  if (direction === "top") {
    expectWithinOnePixel(firstCorridor!.y, firstCell!.y);
    expectWithinOnePixel(neighborCorridor!.y + neighborCorridor!.height, neighborCell!.y + neighborCell!.height);
  }
  if (direction === "bottom") {
    expectWithinOnePixel(firstCorridor!.y + firstCorridor!.height, firstCell!.y + firstCell!.height);
    expectWithinOnePixel(neighborCorridor!.y, neighborCell!.y);
  }
  const expectedEntryOffset = direction === "top" ? "translateY(22px)"
    : direction === "bottom" ? "translateY(-22px)"
      : direction === "left" ? "translateX(22px)"
        : "translateX(-22px)";
  expect(entryAnimationStyle.fromTransform).toContain(expectedEntryOffset);

  await page.clock.runFor(GAME_PARAMETERS.animation.roomTransitionDurationMs);
  await expect(page.getByTestId("room-transition-snapshot")).toHaveCount(0);
  await expect(incomingSnapshot).toHaveCSS("opacity", "1");
  const spriteStayedMounted = await playerSprite.evaluate(element => element === (window as any).__playerSpriteImage);
  expect(spriteStayedMounted).toBe(true);
});

function adjacentRoom(roomId: string, direction: string) {
  const row = roomId[0];
  const column = Number(roomId.slice(1));
  if (direction === "right") return `${row}${column + 1}`;
  if (direction === "left") return `${row}${column - 1}`;
  const rowCode = row.charCodeAt(0) + (direction === "bottom" ? 1 : -1);
  return `${String.fromCharCode(rowCode)}${column}`;
}

function expectWithinOnePixel(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
}
