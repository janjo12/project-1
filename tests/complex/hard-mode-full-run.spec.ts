import { expect, test } from "@playwright/test";
import { HUMAN_REACTION_WINDOW_MS, MULTITAP_TARGET_TAPS, TIMED_ATTACK_CUE_DELAY_MS } from "@/game/actions/use-microgame";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { getTurnDuration } from "@/game/engine/resolveTurn";

const ROOM_TRANSITION_MS = GAME_PARAMETERS.animation.roomTransitionDurationMs;
const ROOM_MOVE_DURATION_MS = GAME_PARAMETERS.animation.roomExitDurationMs + ROOM_TRANSITION_MS;

for (const { seed, className } of [
  { seed: "testwarrior", className: "Warrior" },
  { seed: "testcleric", className: "Cleric" },
  { seed: "testthief", className: "Thief" },
]) {
test(`plays a complete ${className} hard-mode run through Level 2`, async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const frozenTime = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: frozenTime });
  await page.clock.pauseAt(new Date(frozenTime.getTime() + 1_000));

  // Start from a clean launch, just as a newly installed player would.
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("button", { name: "Singleplayer" })).toBeVisible();

  // Select hard mode and the reserved deterministic test dungeon.
  await page.getByRole("button", { name: "Singleplayer" }).click();
  await expect(page.getByText("Difficulty", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "hard", exact: true }).click();
  await page.getByRole("textbox", { name: "Seed" }).fill(seed);
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Start", exact: true }).click();

  // Read both class briefing pages before starting the actual run.
  const briefing = page.getByTestId("class-briefing");
  await expect(briefing).toBeVisible();
  await expect(briefing).toContainText(className);
  await page.getByRole("button", { name: "Next class instructions", exact: true }).click();
  await expect(briefing).toBeVisible();
  await page.getByRole("button", { name: "Start playing", exact: true }).click();
  await page.clock.runFor(ROOM_TRANSITION_MS);

  const turnCounter = page.getByTestId("hard-turn-counter");
  const turnTimer = page.getByTestId("turn-timer");
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(page.getByText("TEST ·", { exact: false })).toBeVisible();
  await expect(turnCounter).toBeVisible();
  await expect(turnTimer).toBeVisible();

  const supportButton = page.getByRole("button", { name: new RegExp(`${className}.*Support`) });
  const initialTurns = readTurns(await turnCounter.innerText());
  const visitedItems = new Set<string>();
  let securedSilverBullet = false;
  let foughtWerewolf = false;
  const foughtOrdinaryEnemyRooms = new Set<string>();
  let firstHealthyHit = false;
  let levelTwoReached = false;
  let thiefUnlockedWithoutKey = false;
  let thiefChargedLockPick = false;
  let usedClassSupport = false;
  let previousRoomId: string | null = null;
  const visitedRoomIds = new Set<string>();

  for (let turn = 0; turn < initialTurns; turn += 1) {
    if (await page.getByText("Game Over", { exact: true }).isVisible().catch(() => false)) break;
    await expect(page.getByTestId("room-incoming-snapshot")).toBeVisible();
    const loopRoomId = await readRoomId(page);
    visitedRoomIds.add(loopRoomId);

    const werewolf = page.getByRole("button", { name: "Werewolf", exact: true });
    if (await werewolf.isVisible().catch(() => false)) {
      await expect(page.getByTestId("item-status")).toContainText("Silver Bullet");
      await page.getByRole("button", { name: "Silver Bullet. Drop item" }).click();
      await expect(page.getByTestId("item-status")).toContainText("No Item");
      await page.getByRole("button", { name: "Charge Up" }).click();
      await werewolf.click();
      await expect(page.getByTestId("microgame-overlay")).toBeVisible();
      const initialEnemyHealth = await enemyHealthPercent(page);
      await playClassMicrogame(page, className);
      await page.clock.runFor(GAME_PARAMETERS.animation.attackDurationMs + GAME_PARAMETERS.animation.enemyTurnDurationMs + ROOM_TRANSITION_MS);
      const finalEnemyHealth = await enemyHealthPercent(page);
      expect(finalEnemyHealth, "a charged attack must not damage the Werewolf").toBe(initialEnemyHealth);

      const droppedBullet = page.getByRole("button", { name: "Silver Bullet", exact: true });
      await expect(droppedBullet).toBeVisible();
      await droppedBullet.click();
      await page.clock.runFor(GAME_PARAMETERS.animation.enemyTurnDurationMs + ROOM_TRANSITION_MS);
      await expect(page.getByTestId("item-status")).toContainText("Silver Bullet");

      await werewolf.click();
      await expect(page.getByTestId("microgame-overlay")).toBeVisible();
      await playClassMicrogame(page, className);
      await page.clock.runFor(GAME_PARAMETERS.animation.attackDurationMs + GAME_PARAMETERS.animation.enemyTurnDurationMs + ROOM_TRANSITION_MS);
      await expect(werewolf).toHaveCount(0);
      foughtWerewolf = true;
      firstHealthyHit = true;
      securedSilverBullet = false;
      if (!usedClassSupport) {
        await supportButton.click();
        await page.clock.runFor(GAME_PARAMETERS.animation.enemyTurnDurationMs + ROOM_TRANSITION_MS);
        if (className === "Thief") {
          const keyDrop = page.getByRole("button", { name: "Key. Drop item" });
          if (await keyDrop.isVisible().catch(() => false)) await keyDrop.click();
          await expect(page.getByTestId("item-status")).not.toContainText("Key");
        }
        usedClassSupport = true;
      }
      continue;
    }

    const collectible = page.getByRole("button", { name: /^(Chest containing )?(Stamina Meal|Health Potion|Key|Silver Bullet|Clock|Good Armor|Good Weapon|Heavy Armor|Heavy Weapon|Amulet|Spyglass)$/ }).first();
    if (await collectible.isVisible().catch(() => false)) {
      const accessibleLabel = await collectible.getAttribute("aria-label");
      const label = accessibleLabel?.replace(/^Chest containing /, "");
      if (accessibleLabel && label && !securedSilverBullet && !visitedItems.has(label) && !(className === "Thief" && label.startsWith("Key"))) {
        const itemRoomId = await readRoomId(page);
        visitedItems.add(label);
        const isEquipment = /^(Good Armor|Good Weapon|Heavy Armor|Heavy Weapon|Amulet|Spyglass)$/.test(label);
        const heldBefore = isEquipment
          ? await page.getByTestId("equipment-slot").getAttribute("aria-label") ?? ""
          : await page.getByTestId("item-status").innerText();
        const slotFull = isEquipment ? !heldBefore.includes("slot empty") : !heldBefore.includes("No Item");
        const opensOnThisClick = accessibleLabel.startsWith("Chest containing ") && slotFull;
        const flight = page.getByTestId("sprite-flight-animation");
        const flightVisible = expect(flight).toBeVisible();
        await collectible.click();
        if (opensOnThisClick) {
          const revealedItem = page.getByRole("button", { name: label, exact: true }).first();
          await expect(revealedItem).toBeVisible();
          await revealedItem.click();
        }
        await flightVisible;
        await page.clock.runFor(Math.max(ROOM_TRANSITION_MS, 500));
        if (await page.getByText("Game Over", { exact: true }).isVisible().catch(() => false)) break;
        const held = await page.getByTestId("item-status").innerText();
        const itemLabel = label.split(".")[0];
        if (held.includes("Silver Bullet")) securedSilverBullet = true;
        if (itemLabel && held.includes(itemLabel)) {
          if (itemLabel === "Key" && className !== "Thief") {
            const lockedDoor = page.getByRole("button", { name: /locked doorway/ }).first();
            await expect(lockedDoor).toBeVisible();
            await lockedDoor.click();
            await page.clock.runFor(ROOM_MOVE_DURATION_MS);
            previousRoomId = itemRoomId;
            await expect(page.getByTestId("item-status")).toContainText("No Item");
          }
        }
        continue;
      }
    }

    const currentEnemy = page.getByRole("button", { name: /^(Pixel Golem|Zombie|Dragon|Vampire)$/ }).first();
    if (await currentEnemy.isVisible().catch(() => false)) {
      const enemyRoomId = await readRoomId(page);
      await page.getByRole("button", { name: "Charge Up" }).click();
      await currentEnemy.click();
      await expect(page.getByTestId("microgame-overlay")).toBeVisible();
      await playClassMicrogame(page, className);
      await page.clock.runFor(GAME_PARAMETERS.animation.attackDurationMs + GAME_PARAMETERS.animation.enemyTurnDurationMs + ROOM_TRANSITION_MS);
      if (!(await currentEnemy.isVisible().catch(() => false))) {
        foughtOrdinaryEnemyRooms.add(enemyRoomId);
      }
      firstHealthyHit = true;
      continue;
    }

    const stairs = page.getByRole("button", { name: "Stairs", exact: true });
    const requiredTestItems = className === "Thief" ? 4 : 5;
    if (await stairs.isVisible().catch(() => false) && visitedItems.size >= requiredTestItems) {
      await stairs.click();
      await expect(page.getByText(/TEST · .*Level 2/)).toBeVisible();
      await page.clock.runFor(ROOM_TRANSITION_MS);
      levelTwoReached = true;
      break;
    }

    const lockedDoor = page.getByRole("button", { name: /locked doorway/ }).first();
    if (className === "Thief" && await lockedDoor.isVisible().catch(() => false)) {
      const heldKey = page.getByRole("button", { name: "Key. Drop item" });
      if (await heldKey.isVisible().catch(() => false)) await heldKey.click();
      await expect(page.getByTestId("item-status")).toContainText("No Item");
      const roomBeforeLockPick = await readRoomId(page);
      if (!thiefUnlockedWithoutKey) {
        await lockedDoor.click();
        await page.clock.runFor(ROOM_TRANSITION_MS);
        expect(await readRoomId(page), "an uncharged lockpick should open the lock without entering the room").toBe(roomBeforeLockPick);
        thiefUnlockedWithoutKey = true;
        continue;
      }
      if (!thiefChargedLockPick) {
        await page.getByRole("button", { name: "Charge Up" }).click();
        await lockedDoor.click();
        await page.clock.runFor(ROOM_MOVE_DURATION_MS);
        expect(await readRoomId(page), "a charged lockpick should open the door and move through it").not.toBe(roomBeforeLockPick);
        await expect(page.getByTestId("item-status")).toContainText("No Item");
        thiefChargedLockPick = true;
        previousRoomId = roomBeforeLockPick;
        visitedRoomIds.add(await readRoomId(page));
        continue;
      }
    }

    const currentRoomId = await readRoomId(page);
    const backDirection = previousRoomId ? directionBetween(currentRoomId, previousRoomId) : null;
    if (await clickOnwardDoor(page, backDirection, currentRoomId, visitedRoomIds)) {
      await page.clock.runFor(ROOM_MOVE_DURATION_MS);
      previousRoomId = currentRoomId;
      visitedRoomIds.add(await readRoomId(page));
    }
    if (await page.getByText("Game Over", { exact: true }).isVisible().catch(() => false)) break;
  }

  expect(firstHealthyHit, "the run should include a successful, realistic attack").toBe(true);
  expect(foughtWerewolf, "the Level 1 werewolf must be defeated").toBe(true);
  expect(foughtOrdinaryEnemyRooms.size, "the run should defeat three distinct non-Werewolf enemies").toBeGreaterThanOrEqual(3);
  expect(visitedItems.size, `collect as many distinct items/equipment as the route allows: ${[...visitedItems].join(", ")}`).toBeGreaterThanOrEqual(className === "Thief" ? 4 : 5);
  expect(levelTwoReached, "the run should reach Level 2 before the timed-out turns").toBe(true);
  expect(usedClassSupport, `${className} should use its support ability during the run`).toBe(true);
  if (className === "Thief") {
    expect(thiefUnlockedWithoutKey, "the Thief should pick a locked door without carrying a key").toBe(true);
  }
  await expect(page.getByText(/TEST · .*Level 2/)).toBeVisible();

  let turnsRemaining = Number((await turnCounter.innerText()).match(/(\d+) Turns?$/)?.[1]);
  expect(Number.isFinite(turnsRemaining)).toBe(true);
  expect(turnsRemaining).toBeGreaterThan(0);

  const maximumTurns = turnsRemaining + GAME_PARAMETERS.turn.clockBaseTurns + 4;
  for (let elapsedTurn = 0; elapsedTurn < maximumTurns; elapsedTurn += 1) {
    const heldItemBeforeTimeout = await page.getByTestId("item-status").innerText();
    await page.clock.runFor(getTurnDuration({ difficulty: "hard", level: 2 }) + GAME_PARAMETERS.turn.gameLoopTickMs);
    await page.clock.runFor(GAME_PARAMETERS.animation.enemyTurnDurationMs + ROOM_TRANSITION_MS);
    if (await page.getByText("Game Over", { exact: true }).isVisible().catch(() => false)) {
      break;
    }
    const currentCounter = await turnCounter.innerText();
    const nextTurnsRemaining = Number(currentCounter.match(/(\d+) Turns?$/)?.[1]);
    expect(Number.isFinite(nextTurnsRemaining), `could not read turn budget: ${currentCounter}`).toBe(true);
    if (nextTurnsRemaining > turnsRemaining) {
      expect(heldItemBeforeTimeout, "a Clock should extend the hard-mode turn budget once").toContain("Clock");
      expect(nextTurnsRemaining).toBe(GAME_PARAMETERS.turn.clockBaseTurns + 2);
      await expect(page.getByTestId("item-status")).not.toContainText("Clock");
    } else {
      expect(nextTurnsRemaining, "a hard-mode timer expiration should resolve a turn").toBeLessThan(turnsRemaining);
    }
    turnsRemaining = nextTurnsRemaining;
  }

  await expect(page.getByText("Game Over", { exact: true })).toBeVisible();
  await expect(page.getByText("Score: 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Return to Title" })).toBeVisible();
  await page.getByRole("button", { name: "Return to Title" }).click();

  // Finish on the app's title menu, ready to begin another run.
  await expect(page.getByRole("button", { name: "Singleplayer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Multiplayer" })).toBeVisible();
});
}

function readTurns(counter: string) {
  const turns = Number(counter.match(/(\d+) Turns?$/)?.[1]);
  expect(Number.isFinite(turns)).toBe(true);
  return turns;
}

async function enemyHealthPercent(page: import("@playwright/test").Page) {
  const bar = page.getByTestId("enemy-health-bar");
  return Number(await bar.getAttribute("aria-valuenow"));
}

async function playClassMicrogame(page: import("@playwright/test").Page, className: string) {
  if (className === "Warrior") {
    const target = page.getByRole("button", { name: "Tap circle" });
    for (let tap = 0; tap < MULTITAP_TARGET_TAPS; tap += 1) {
      await page.clock.runFor(HUMAN_REACTION_WINDOW_MS);
      await target.click();
    }
    return;
  }

  if (className === "Thief") {
    await page.clock.runFor(TIMED_ATTACK_CUE_DELAY_MS + 16);
    await expect(page.getByTestId("timed-attack-now")).toBeVisible();
    await page.clock.runFor(HUMAN_REACTION_WINDOW_MS);
    await page.getByRole("button", { name: "Tap the game screen" }).click();
    return;
  }

  await page.clock.runFor(32);
  const target = page.getByTestId("concentration-target");
  const mover = page.getByTestId("concentration-mover");
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  const targetCenter = targetBox!.x + targetBox!.width / 2;
  let aligned = false;
  for (let elapsed = 0; elapsed < 1250; elapsed += 16) {
    const moverBox = await mover.boundingBox();
    expect(moverBox).not.toBeNull();
    if (Math.abs(moverBox!.x + moverBox!.width / 2 - targetCenter) <= 12) {
      aligned = true;
      break;
    }
    await page.clock.runFor(16);
  }
  expect(aligned, "the Cleric concentration target should cross its outline").toBe(true);
  await page.clock.runFor(HUMAN_REACTION_WINDOW_MS);
  await page.getByRole("button", { name: "Tap when the filled circle fills the outline" }).click();
}

async function readRoomId(page: import("@playwright/test").Page) {
  const status = await page.getByTestId("turn-status").innerText();
  return status.match(/Room ([A-F](?:1[0-2]|[1-9]))/)?.[1] ?? "";
}

function directionBetween(from: string, to: string) {
  const fromColumn = from.charCodeAt(0);
  const toColumn = to.charCodeAt(0);
  const fromRow = Number(from.slice(1));
  const toRow = Number(to.slice(1));
  if (toColumn < fromColumn) return "top";
  if (toColumn > fromColumn) return "bottom";
  if (toRow < fromRow) return "left";
  if (toRow > fromRow) return "right";
  return "";
}

async function clickOnwardDoor(
  page: import("@playwright/test").Page,
  backDirection: string | null,
  roomId: string,
  visitedRoomIds: Set<string>,
) {
  const doorways = page.getByRole("button", { name: /Tap .* doorway to move/ });
  const candidates: Array<{ doorway: typeof doorways; direction: string }> = [];
  for (let index = 0; index < await doorways.count(); index += 1) {
    const doorway = doorways.nth(index);
    const label = await doorway.getAttribute("aria-label") ?? "";
    const direction = label.match(/^Tap (top|right|bottom|left) doorway to move$/)?.[1];
    if (direction) candidates.push({ doorway, direction });
  }
  const unexplored = candidates.find(({ direction }) =>
    direction !== backDirection && !visitedRoomIds.has(roomInDirection(roomId, direction)),
  );
  const fallback = candidates.find(({ direction }) => direction !== backDirection) ?? candidates[0];
  const target = unexplored ?? fallback;
  if (target) {
    await target.doorway.click();
    return true;
  }
  return false;
}

function roomInDirection(roomId: string, direction: string) {
  const column = roomId.charCodeAt(0);
  const row = Number(roomId.slice(1));
  if (direction === "top") return `${String.fromCharCode(column - 1)}${row}`;
  if (direction === "bottom") return `${String.fromCharCode(column + 1)}${row}`;
  if (direction === "left") return `${String.fromCharCode(column)}${row - 1}`;
  return `${String.fromCharCode(column)}${row + 1}`;
}
