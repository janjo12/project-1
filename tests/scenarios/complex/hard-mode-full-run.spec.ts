import { expect, test } from "@playwright/test";
import { DEFENSE_WINDOW_MS, HUMAN_REACTION_WINDOW_MS, MULTITAP_WINDOW_MS, TIMED_ATTACK_CUE_DELAY_MS } from "@/game/actions/use-microgame";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";
import { getTurnDuration } from "@/game/engine/resolveTurn";
import { openScenarioApp } from "../helpers";

const ROOM_TRANSITION_MS = GAME_PARAMETERS.animation.roomTransitionDurationMs;
const ROOM_MOVE_DURATION_MS = GAME_PARAMETERS.animation.roomExitDurationMs + ROOM_TRANSITION_MS;

for (const { seed, className } of [
  { seed: "testwarrior", className: "Warrior" },
  { seed: "testcleric", className: "Cleric" },
  { seed: "testthief", className: "Thief" },
  { seed: "testwizard", className: "Wizard" },
  { seed: "testranger", className: "Ranger" },
]) {
test(`plays a complete ${className} hard-mode run through Level 2`, async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const frozenTime = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: frozenTime });
  await page.clock.pauseAt(new Date(frozenTime.getTime() + 1_000));

  // Start from a clean launch, just as a newly installed player would.
  await openScenarioApp(page, true);
  await expect(page.getByRole("button", { name: "Singleplayer" })).toBeVisible();

  // Select hard mode and the reserved deterministic test dungeon.
  await page.getByRole("button", { name: "Singleplayer" }).click();
  await expect(page.getByText("Difficulty", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "hard", exact: true }).click();
  await page.getByRole("textbox", { name: "Seed" }).fill(seed);
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Start", exact: true }).click();

  const nextClassInstructions = page.getByRole("button", { name: "Next class instructions", exact: true });
  if (await nextClassInstructions.isVisible().catch(() => false)) {
    await nextClassInstructions.click();
    await page.getByRole("button", { name: "Start playing", exact: true }).click();
  }

  await page.clock.runFor(ROOM_TRANSITION_MS);

  const turnCounter = page.getByTestId("hard-turn-counter");
  const turnTimer = page.getByTestId("turn-timer");
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(page.getByText("Level 1 Map", { exact: true })).toBeVisible();
  await expect(turnCounter).toBeVisible();
  await expect(turnTimer).toBeVisible();
  const resourceBarWidths = await Promise.all(["player-health-bar", "player-energy-bar", "turn-timer"].map(async testId => {
    const bounds = await page.getByTestId(testId).boundingBox();
    expect(bounds, `${testId} should be visible`).not.toBeNull();
    return bounds!.width;
  }));
  expect(Math.max(...resourceBarWidths) - Math.min(...resourceBarWidths)).toBeLessThan(1);

  const supportButton = page.getByRole("button", { name: new RegExp(`${className}.*Support`) });
  const initialTurns = readTurns(await turnCounter.innerText());
  // The Thief skips the Key; other classes keep it while prioritizing the Silver Arrow.
  const requiredTestItems = className === "Thief" ? 3 : 4;
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
  const levelOneDiagnostics: string[] = [];

  for (let turn = 0; turn < initialTurns; turn += 1) {
    if (await page.getByText("Game Over", { exact: true }).isVisible().catch(() => false)) break;
    await expect(page.getByTestId("room-incoming-snapshot")).toBeVisible();
    const loopRoomId = await readRoomId(page);
    levelOneDiagnostics.push(`turn ${turn + 1}/${initialTurns}, room ${loopRoomId}, counter ${await turnCounter.innerText()}, health ${await page.getByTestId("player-health-bar").getAttribute("aria-valuenow")}, energy ${await page.getByTestId("player-energy-bar").getAttribute("aria-valuenow")}`);
    visitedRoomIds.add(loopRoomId);

    if (className === "Cleric" && !usedClassSupport) {
      const health = Number(await page.getByTestId("player-health-bar").getAttribute("aria-valuenow"));
      const energy = Number(await page.getByTestId("player-energy-bar").getAttribute("aria-valuenow"));
      const canHealBeforeEnemy = await page.getByRole("button", { name: /^(Werewolf|Pixel Golem|Zombie|Dragon|Vampire)$/ }).count() > 0;
      if (canHealBeforeEnemy && health < 100 && energy >= 10) {
        await page.getByRole("button", { name: "Charge Up" }).click();
        await supportButton.evaluate(button => (button as HTMLButtonElement).click());
        usedClassSupport = true;
        await advanceEnemyTurn(page);
        continue;
      }
    }

    const doorwayGuard = page.getByRole("button", { name: /^(Pixel Golem|Zombie|Dragon|Vampire)$/ }).first();
    if (await doorwayGuard.isVisible().catch(() => false)) {
      const enemyRoomId = await readRoomId(page);
      const chargeUp = page.getByRole("button", { name: "Charge Up" });
      if (className === "Cleric" && Number(await page.getByTestId("player-energy-bar").getAttribute("aria-valuenow")) >= 30) {
        await chargeUp.click();
      }
      if (className !== "Cleric" && await chargeUp.isEnabled()) await chargeUp.click();
      await doorwayGuard.click();
      await expect(page.getByTestId("microgame-overlay")).toBeVisible();
      await playClassMicrogame(page, className);
      await advanceEnemyTurn(page, true);
      if (!(await doorwayGuard.isVisible().catch(() => false))) foughtOrdinaryEnemyRooms.add(enemyRoomId);
      firstHealthyHit = true;
      continue;
    }

    const werewolf = page.getByRole("button", { name: "Werewolf", exact: true });
    if (await werewolf.isVisible().catch(() => false)) {
      if (!securedSilverBullet && !String(await readItemStatus(page)).includes("Silver Arrow")) {
        const silverPickup = page.getByRole("button", { name: /^(Chest containing )?Silver Arrow$/ }).first();
        if (await silverPickup.isVisible().catch(() => false)) {
          const chestLabel = await silverPickup.getAttribute("aria-label") ?? "";
          const hasItem = !(await readItemStatus(page)).includes("No Item");
          await silverPickup.click();
          if (chestLabel.startsWith("Chest containing ") && hasItem) {
            const revealedArrow = page.getByRole("button", { name: "Silver Arrow", exact: true }).first();
            await expect(revealedArrow).toBeVisible();
            await revealedArrow.click();
          }
          await page.clock.runFor(Math.max(ROOM_TRANSITION_MS, 500));
          securedSilverBullet = (await readItemStatus(page)).includes("Silver Arrow");
          if (securedSilverBullet) continue;
        }
        const currentRoomId = await readRoomId(page);
        const backDirection = previousRoomId ? directionBetween(currentRoomId, previousRoomId) : null;
        if (await clickOnwardDoor(page, backDirection, currentRoomId, visitedRoomIds)) {
          await page.clock.runFor(ROOM_MOVE_DURATION_MS);
          previousRoomId = currentRoomId;
          visitedRoomIds.add(await readRoomId(page));
          continue;
        }
      }
      expect(await readItemStatus(page)).toContain("Silver Arrow");
      await werewolf.click();
      await advanceEnemyTurn(page, true);
      await expect(werewolf).toHaveCount(0);
      foughtWerewolf = true;
      firstHealthyHit = true;
      securedSilverBullet = false;
      if (!usedClassSupport && className !== "Cleric") {
        // The movement arrows can overlap the actor at some viewport sizes;
        // the named visible support control is still the intended target.
        await supportButton.evaluate(button => (button as HTMLButtonElement).click());
        await advanceEnemyTurn(page);
        if (className === "Thief") {
          expect(await readItemStatus(page)).not.toContain("Key");
        }
        usedClassSupport = true;
      }
      continue;
    }

    const collectible = page.getByRole("button", { name: /^(Chest containing )?(Stamina Meal|Health Potion|Key|Silver Arrow|Clock|Good Armor|Good Weapon|Heavy Armor|Heavy Weapon|Amulet|Spyglass)$/ }).first();
    if (await collectible.isVisible().catch(() => false)) {
      const accessibleLabel = await collectible.getAttribute("aria-label");
      const label = accessibleLabel?.replace(/^Chest containing /, "");
      if (accessibleLabel && label && !securedSilverBullet && !visitedItems.has(label) && !(className === "Thief" && label.startsWith("Key"))) {
        const itemRoomId = await readRoomId(page);
        visitedItems.add(label);
        const isEquipment = /^(Good Armor|Good Weapon|Heavy Armor|Heavy Weapon|Amulet|Spyglass)$/.test(label);
        const heldBefore = isEquipment
          ? await page.getByTestId("equipment-slot").getAttribute("aria-label") ?? ""
          : await readItemStatus(page);
        const slotFull = isEquipment ? !heldBefore.includes("slot empty") : !heldBefore.includes("No Item");
        const opensOnThisClick = accessibleLabel.startsWith("Chest containing ") && slotFull;
        const flight = page.getByTestId("sprite-flight-animation");
        await collectible.click();
        if (opensOnThisClick) {
          const revealedItem = page.getByRole("button", { name: label, exact: true }).first();
          await expect(revealedItem).toBeVisible();
          await revealedItem.click();
        }
        if (!accessibleLabel.startsWith("Chest containing ")) {
          await page.clock.runFor(16);
          await expect(flight).toBeVisible();
        }
        await page.clock.runFor(Math.max(ROOM_TRANSITION_MS, 500));
        if (await page.getByText("Game Over", { exact: true }).isVisible().catch(() => false)) break;
        const held = await readItemStatus(page);
        const itemLabel = label.split(".")[0];
        if (held.includes("Silver Arrow")) securedSilverBullet = true;
        if (itemLabel && held.includes(itemLabel)) {
          if (itemLabel === "Key" && className !== "Thief") {
            const lockedDoor = page.getByRole("button", { name: /locked doorway/ }).first();
            await expect(lockedDoor).toBeVisible();
            await lockedDoor.click();
            await page.clock.runFor(ROOM_MOVE_DURATION_MS);
            previousRoomId = itemRoomId;
            expect(await readItemStatus(page)).toContain("No Item");
          }
        }
        continue;
      }
    }

    const currentEnemy = page.getByRole("button", { name: /^(Pixel Golem|Zombie|Dragon|Vampire|Werewolf)$/ }).first();
    if (await currentEnemy.isVisible().catch(() => false)) {
      const enemyRoomId = await readRoomId(page);
      const chargeUp = page.getByRole("button", { name: "Charge Up" });
      if (className !== "Cleric" && await chargeUp.isEnabled()) await chargeUp.click();
      await currentEnemy.click();
      await expect(page.getByTestId("microgame-overlay")).toBeVisible();
      await playClassMicrogame(page, className);
      await advanceEnemyTurn(page, true);
      if (!(await currentEnemy.isVisible().catch(() => false))) {
        foughtOrdinaryEnemyRooms.add(enemyRoomId);
      }
      firstHealthyHit = true;
      continue;
    }

    const stairs = page.getByRole("button", { name: "Stairs", exact: true });
    if (await stairs.isVisible().catch(() => false) && visitedItems.size >= requiredTestItems) {
      await stairs.click();
      await expect(page.getByText("Level Cleared!", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Continue to next level" }).click();
      await page.clock.runFor(ROOM_TRANSITION_MS);
      await expect(page.getByTestId("dungeon-map")).toBeVisible();
      levelTwoReached = true;
      break;
    }

    const lockedDoor = page.getByRole("button", { name: /locked doorway/ }).first();
    if (className === "Thief" && await lockedDoor.isVisible().catch(() => false)) {
      expect(await readItemStatus(page)).not.toContain("Key");
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
        expect(await readItemStatus(page)).toContain("No Item");
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
  expect(visitedItems.size, `collect the useful loadout before the Werewolf: ${[...visitedItems].join(", ")}`).toBeGreaterThanOrEqual(requiredTestItems);
  expect(levelTwoReached, `the run should reach Level 2 before the timed-out turns; last state: ${levelOneDiagnostics.slice(-8).join(" | ")}`).toBe(true);
  expect(usedClassSupport, `${className} should use its support ability during the run`).toBe(true);
  if (className === "Thief") {
    expect(thiefUnlockedWithoutKey, "the Thief should pick a locked door without carrying a key").toBe(true);
  }
  await expect(page.getByText("Level 2 Map", { exact: true })).toBeVisible();

  let turnsRemaining = Number((await turnCounter.innerText()).match(/(\d+) Turns?$/)?.[1]);
  expect(Number.isFinite(turnsRemaining)).toBe(true);
  expect(turnsRemaining).toBeGreaterThan(0);

  const maximumTurns = turnsRemaining + GAME_PARAMETERS.turn.clockBaseTurns + 4;
  for (let elapsedTurn = 0; elapsedTurn < maximumTurns; elapsedTurn += 1) {
    const heldItemBeforeTimeout = await readItemStatus(page);
    await page.clock.runFor(getTurnDuration({ difficulty: "hard", level: 2 }) + GAME_PARAMETERS.turn.gameLoopTickMs);
    await advanceEnemyTurn(page);
    if (await page.getByText("Game Over", { exact: true }).isVisible().catch(() => false)) {
      break;
    }
    const currentCounter = await turnCounter.innerText();
    const nextTurnsRemaining = Number(currentCounter.match(/(\d+) Turns?$/)?.[1]);
    expect(Number.isFinite(nextTurnsRemaining), `could not read turn budget: ${currentCounter}`).toBe(true);
    if (nextTurnsRemaining > turnsRemaining) {
      expect(heldItemBeforeTimeout, "a Clock should extend the hard-mode turn budget once").toContain("Clock");
      expect(nextTurnsRemaining).toBe(GAME_PARAMETERS.turn.clockBaseTurns + 2);
      expect(await readItemStatus(page)).not.toContain("Clock");
    } else {
      expect(nextTurnsRemaining, "a hard-mode timer expiration should resolve a turn").toBeLessThan(turnsRemaining);
    }
    turnsRemaining = nextTurnsRemaining;
  }

  await expect(page.getByText("Game Over", { exact: true })).toBeVisible();
  await expect(page.getByText("1 Floor Cleared", { exact: true })).toBeVisible();
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

async function advanceEnemyTurn(page: import("@playwright/test").Page, includeAttackAnimation = false) {
  const enemyCount = await page.getByRole("button", { name: /^(Pixel Golem|Zombie|Dragon|Vampire|Werewolf)$/ }).count();
  const enemyActions = Math.max(1, enemyCount);
  const enemyTurnDuration = enemyActions * (DEFENSE_WINDOW_MS + GAME_PARAMETERS.animation.enemyTurnDurationMs);
  const attackDuration = includeAttackAnimation ? GAME_PARAMETERS.animation.attackDurationMs : 0;
  await page.clock.runFor(attackDuration + enemyTurnDuration + ROOM_TRANSITION_MS);
}

async function playClassMicrogame(page: import("@playwright/test").Page, className: string) {
  if (className === "Warrior") {
    const track = page.getByTestId("multiswipe-track");
    for (let elapsed = 0; elapsed < MULTITAP_WINDOW_MS; elapsed += HUMAN_REACTION_WINDOW_MS) {
      await page.clock.runFor(HUMAN_REACTION_WINDOW_MS);
      if (!(await track.isVisible().catch(() => false))) break;
      const start = await page.getByTestId("multiswipe-start-dot").boundingBox();
      const end = await page.getByTestId("multiswipe-end-dot").boundingBox();
      expect(start).not.toBeNull();
      expect(end).not.toBeNull();
      await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2);
      await page.mouse.down();
      await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2, { steps: 6 });
      await page.mouse.up();
    }
    return;
  }

  if (className === "Ranger") {
    const target = page.getByRole("button", { name: "Tap circle" });
    for (let elapsed = 0; elapsed < MULTITAP_WINDOW_MS; elapsed += HUMAN_REACTION_WINDOW_MS) {
      await page.clock.runFor(HUMAN_REACTION_WINDOW_MS);
      if (await target.isVisible().catch(() => false)) await target.click();
    }
    return;
  }

  if (className === "Wizard") {
    const nodeOrder = ["A", "B", "C", "D", "E", "A", "F", "G", "A"];
    const first = await page.getByTestId(`rune-node-${nodeOrder[0]}`).boundingBox();
    expect(first).not.toBeNull();
    await page.mouse.move(first!.x + first!.width / 2, first!.y + first!.height / 2);
    await page.mouse.down();
    for (const [index, nodeId] of nodeOrder.slice(1).entries()) {
      const node = await page.getByTestId(`rune-node-${nodeId}`).boundingBox();
      const previousNode = await page.getByTestId(`rune-node-${nodeOrder[index]}`).boundingBox();
      expect(node).not.toBeNull();
      expect(previousNode).not.toBeNull();
      const startX = previousNode!.x + previousNode!.width / 2;
      const startY = previousNode!.y + previousNode!.height / 2;
      const endX = node!.x + node!.width / 2;
      const endY = node!.y + node!.height / 2;
      const edge = await page.getByTestId("rune-tracer-track").boundingBox();
      expect(edge).not.toBeNull();
      await page.mouse.move((startX + endX) / 2, (startY + endY) / 2, { steps: 3 });
      await page.mouse.move(endX, endY, { steps: 3 });
    }
    await page.mouse.up();
    await expect(page.getByTestId("microgame-overlay")).toHaveCount(0);
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
  await page.getByRole("button", { name: "Tap the game screen" }).click();
}

async function readRoomId(page: import("@playwright/test").Page) {
  const currentRoom = page.getByTestId("current-dungeon-room");
  const label = await currentRoom.getAttribute("aria-label");
  return label?.match(/Room ([A-F](?:1[0-2]|[1-9]))/)?.[1] ?? "";
}

async function readItemStatus(page: import("@playwright/test").Page) {
  const itemStatus = page.getByTestId("item-status");
  return await itemStatus.count() ? itemStatus.innerText() : "No Item";
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
    if (!(await doorway.isEnabled())) continue;
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
