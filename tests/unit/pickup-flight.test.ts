import { act, renderHook } from "@testing-library/react-native";
import { requestPickupSpriteFlight, type PickupFlightActor } from "@/game/actions/pickup-flight";
import { isRunGameLoopEnabled } from "@/game/engine/game-loop-policy";
import { useGameLoopDriver } from "@/game/engine/use-game-loop-driver";
import { GAME_PARAMETERS } from "@/game/config/gameparameters";

const point = (x: number, y: number) => ({ x, y });

afterEach(() => jest.useRealTimers());

test.each([
  { actor: { kind: "item", label: "Health Potion", contentSprite: "health_potion_graphic" } },
  { actor: { kind: "equipment", label: "Good Armor", contentSprite: "good_armor_graphic" } },
])("singleplayer $actor.kind pickup requests its sprite flight", ({ actor }) => {
  const animate = jest.fn();
  requestPickupSpriteFlight(actor as PickupFlightActor, point(10, 20), point(30, 40), animate);
  expect(animate).toHaveBeenCalledWith({
    start: point(10, 20), end: point(30, 40), sprite: actor.contentSprite, label: actor.label,
  });
});

test.each(["pauseMenuOpen", "itemMenuOpen", "equipmentMenuOpen", "mapOpen"] as const)("opening the %s pauses the singleplayer turn timer", menu => {
  jest.useFakeTimers();
  let frameCount = 0;
  let expiryCount = 0;
  const loop = {
    enabled: isRunGameLoopEnabled({ running: true, [menu]: true }),
    isTurnClockActive: () => true,
    onExpire: () => { expiryCount += 1; },
    onFrame: () => { frameCount += 1; },
    turnDuration: GAME_PARAMETERS.turn.gameLoopTickMs,
    levelNumber: 1,
    turnNumber: 1,
  };
  renderHook(() => useGameLoopDriver(loop));
  act(() => jest.advanceTimersByTime(GAME_PARAMETERS.turn.gameLoopTickMs * 3));
  expect(frameCount).toBe(0);
  expect(expiryCount).toBe(0);
});

test("the turn loop stays enabled when no menu is open", () => {
  expect(isRunGameLoopEnabled({ running: true })).toBe(true);
  expect(isRunGameLoopEnabled({ running: false })).toBe(false);
});
