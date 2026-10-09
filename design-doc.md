# Dungeon Run: Product and Technical Design

## 1. Purpose

Dungeon Run is a compact, turn-based dungeon adventure for mobile devices and the web. A player explores a seeded room network, makes one deliberate action at a time, spends health and energy to survive encounters, and descends through floors for a higher score. Three character classes give the same dungeon different tactical options. Easy, Normal, and Hard tune the pressure on the player. A same-Wi-Fi multiplayer mode lets a small group explore one shared dungeon using one device per player.

This document describes the product behavior and the implementation’s design choices. Unless a section is marked as a future consideration, it describes the current app rather than a proposal.

## 2. Product goals

- Let a new player start a run without completing a text tutorial.
- Make the dungeon, available actions, player resources, and turn pressure understandable from the game screen.
- Keep combat outcomes tied to the chosen action and a short, skill-based microgame.
- Make a seed reproduce the same dungeon so runs can be replayed and tested.
- Support both native mobile and browser play from shared game rules.
- Make multiplayer usable without a central game server or third-device host.
- Keep the design small enough that each class, item, enemy, and screen has a clear gameplay purpose.

## 3. Target platforms and app shape

### Native

The native app uses Expo and Expo Router. The main routes are the title screen, run setup, settings, single-player game, multiplayer, and game over. React Native components render the common interface; native-specific component variants handle platform differences where needed. Haptics are used for damage feedback when enabled.

### Web

The browser app is served by Next.js. `app/page.tsx` owns title/setup/settings/game/multiplayer/game-over navigation state, while `app/RunScreens.tsx` contains the extracted setup, settings, and single-player screens. It imports the same shared game rules and most of the same React Native UI through React Native Web, with `.web` component variants where browser interaction or styling differs.

### Shared-code boundary

`src/game/` owns game state types, dungeon generation and operations, entities, actions, rules, turn resolution, and reusable controllers. App shells own route/page navigation, platform lifecycle, settings entry points, and the scheduling required to run the shared game loop. Shared UI lives under `src/components/`. Multiplayer transport lives under `src/multiplayer/`.

The native and web single-player screens currently have parallel compositions. Changes to shared rules belong in `src/game/`; gameplay UI changes may need matching updates in `src/app/game.tsx` and `app/RunScreens.tsx`.

## 4. Player journey and screens

1. **Title:** choose Singleplayer or Multiplayer.
2. **Run setup:** choose difficulty and seed. The app supplies a generated seed when the player leaves the seed blank. A player can open Settings from setup.
3. **Class briefing:** review the randomly assigned class and continue into the run. Ordinary runs randomly choose Warrior, Cleric, or Thief on each new run, even when replaying the same dungeon seed. Reserved test seeds pin their named class for repeatable browser tests.
4. **Gameplay:** explore rooms, collect items or equipment, fight enemies, use class support, charge actions, and find the stairs.
5. **Level transition:** descend to the next floor. A surviving run gains score through cleared levels; maps are generated per seed and level.
6. **Game over:** show the final score and allow return to the title screen.

Settings include appearance (`system`, `light`, `dark`), handedness, vibration, and reduced motion. The appearance selector can return to System after a fixed theme is chosen. Reduced motion is available in Settings and the in-game menu and is combined with the platform's reduced-motion preference. It skips room slides, doorway pulsing, and idle enemy bobbing. Settings are normalized when loaded so missing or invalid values fall back to defaults. Browser settings use local storage; native settings use AsyncStorage. The current defaults are Easy, system appearance, right-handed controls, vibration on, reduced motion off, and a blank seed.

## 5. Core gameplay loop

The player starts in the revealed start room. They can inspect visible exits and room contents, then choose an action. The game validates that action against the current map and resolves movement, pickup, combat, support, or descent. The room changes and enemy responses are presented with brief transitions and feedback. The player repeats until they descend, run out of turns, or lose all survivability.

### Room network and navigation

- A floor is a 12 by 6 grid of possible room locations. Generated floors activate a connected subset of those locations.
- Rooms connect through shared boundaries. A boundary is a wall, open doorway, locked doorway, or guarded doorway.
- Movement follows compass directions. The visual interface places exits around the active room; native and web variants preserve the same game meaning.
- The current room and discovered rooms are represented in the map state. The start room is revealed at generation; adjacent-room visibility is updated through movement and map operations.
- Locked doors require a key for ordinary classes. The Thief can pick a lock; charging can combine picking with moving through the door in one action.
- Guarded doors require resolving the guard encounter before passage is available.
- Stairs are placed on the floor and allow the player to descend when reached.

### Actions and turns

Player actions include moving through a doorway, picking up a room item or equipment, attacking a targetable enemy, using class support on self (or an ally in multiplayer), charging an eligible action, dropping held gear, and descending at stairs. Action validity is checked against current state so stale targets cannot perform impossible moves or attacks.

Easy has no run-wide turn limit and no per-turn countdown. Normal has a run-wide turn limit. Hard has the same kind of turn limit and also gives a short countdown for each action. In single-player, an expired Hard timer forfeits the action and the turn advances; enemy behavior still resolves. Floor turn budgets are based on active room count, at four turns per active room, with a minimum of one. The extra turn per room gives the player room to traverse, collect useful items, and resolve encounters before reaching the stairs. If the final turn would be lost while the player holds a Clock, the Clock is consumed and grants five plus the current floor number additional turns. The Hard action timer starts at five seconds and becomes faster on higher floors, down to a two-second minimum. Normal uses a six-second base duration for the shared turn timing path but does not show the Hard countdown.

### Health, energy, equipment, and recovery

- Player maximum health and energy are each 100.
- Base player attack is 10 and base defense is 10. The Warrior has five additional starting defense.
- A charged action normally spends 10 energy. Amulets can lower that cost. Charge effects depend on the action and class; eligible free actions refund their charge cost after resolution.
- Health Potions restore half of maximum health when health would otherwise reach zero. Stamina Meals restore half of maximum energy when energy would otherwise reach zero.
- Equipment modifies attack, defense, or charge cost. Some equipment trades one combat stat for another. Spyglass reveals adjacent room information. Cursed Amulet has a recurring health cost.
- A player can drop held item or equipment into the current room to make inventory choices and item use explicit.

## 6. Classes and microgames

Each ordinary run randomly selects Warrior, Cleric, or Thief independently of the dungeon seed. The reserved seeds `test` and `testwarrior` select Warrior, `testcleric` selects Cleric, and `testthief` selects Thief; this keeps browser tests deterministic. These reserved test seeds use the same deterministic Level 1 corridor layout; their class differs by seed. Other floor maps remain generated from the seed and level.

| Class | Core advantage | Support action | Class microgame |
|---|---|---|---|
| Warrior | Starts with 15 defense. | Vanguard lets the Warrior retaliate when attacked for one turn; charging adds defense for that turn. | Multitap |
| Cleric | Miracle spends remaining energy to survive lethal damage when no Health Potion saves the player. | Aid adds defense for two turns; charging also restores health. | Concentration |
| Thief | Can pick locked doors; charging can pick and pass in one action. | Enrich has a chance to grant an item or equipment; a full slot drops the reward in the room. | Timed Attack |

The microgame score affects the attack result. Scoring is clamped to 0–100. Each microgame is designed around an explicit 250 ms human reaction allowance:

- **Concentration:** the player taps when the moving fill reaches the target. The target travel duration is 1,250 ms within a 1,500 ms game window; scoring compares the observed tap after subtracting the reaction allowance with the target crossing time.
- **Timed Attack:** “NOW!” appears after a one-second delay. The intended tap is 250 ms after the cue. The interaction window includes reaction time and a small tolerance.
- **Multitap:** the target moves between taps. Ten taps at a realistic 250 ms pace fit within the 3,000 ms window; each tap contributes ten score points, capped at 100.

The overlay displays the active instruction, target/cue, and progress needed to make timing expectations visible. Microgames are used in actual gameplay and practice; game rules do not substitute an instant perfect score for real input.

## 7. Enemies and combat

The enemy catalog includes Pixel Golem, Zombie, Dragon, Vampire, and Werewolf. Each has health, damage, and visual identity. Enemy attacks apply player defense; incoming damage cannot reduce below zero. Player damage is adjusted by attack type, charge, equipment, and microgame score. Werewolf encounters are special: the Werewolf pursues the player after it has been encountered, and a Silver Bullet defeats it immediately. Without the bullet, the player can fight through ordinary attacks. The Werewolf is intentionally dangerous so that movement, defense, charge, and recovery items matter.

Combat is a short sequence: choose a target, play the class microgame, apply score-adjusted damage, show impact feedback, resolve the enemy response, then return control. Animation durations and impact timing are centralized in the game tuning table so the sequence stays aligned across platforms.

## 8. Dungeon generation and replayability

The dungeon is derived from the seed and floor number with a deterministic pseudo-random stream. Repeating a seed and floor produces the same generated map independent of unrelated prior random calls. Generation builds a connected room network, may add loops, places doorway guards, stairs, a reachable locked connection with a key when applicable, a Werewolf and counter-item when selected, and optional loot/equipment in eligible rooms.

The `test`, `testwarrior`, `testcleric`, and `testthief` Level 1 maps are deliberately authored over a deterministic generated grid as a single route. They place all five catalog items (meal, potion, key, bullet, clock), three ordinary Pixel Golems, a Werewolf, and stairs in known route positions, with a locked doorway after the key. This layout supports reproducible UI and end-to-end gameplay. These are reserved development/test seeds and should not be treated as normal random seeds.

## 9. Multiplayer design

Multiplayer is a shared same-Wi-Fi dungeon with one independently controlled character per connected device. Each character has its own room position, health, energy, item, equipment, class, defense buff, and Warrior retaliation state. A random class is assigned to the run and shared by the roster. The dungeon, enemy health, and doors are shared.

The host creates a session and guests join through a manually copied invitation/reply exchange. There is no signaling server, central game host, STUN/TURN service, QR scanner, or automatic discovery in the current version. WebRTC uses an empty ICE server list; networks with client isolation can prevent connections. The host owns the authoritative game state and resolves actions in stable roster order, so contested pickups have deterministic precedence rather than depending on packet arrival order.

Multiplayer turns are simultaneous team turns, not the single-player animation sequence. Each living player submits an action; the host resolves the action set. Hard mode uses a host-owned timer and skips missing actions while enemies still attack. Easy and Normal wait for each living player. All living players must gather at the stairs before one may descend. Fallen players spectate and revive at the next level. The run ends when all players fall or the shared turn budget is exhausted. There is no active-run rejoin or host migration; the host must remain foregrounded.

Native WebRTC requires an Expo native development or production build; Expo Go does not support hosting or joining. Transport tests use mocked native WebRTC at the boundary, while game resolver tests exercise shared turn logic.

## 10. Visual and interaction principles

- A screen should have a clear next action. Start and Return to Title receive primary emphasis; gameplay actions share emphasis because no single action is always dominant.
- Difficulty choices use short labels and a three-option segmented control.
- A help control is available near setup choices to explain difficulty and seed behavior.
- Health, energy, held item/equipment, turn budget, and Hard timer are shown close to the play surface.
- Room transitions, enemy movement, damage, and resource loss use short animations. Reduced-motion settings should be respected by motion-sensitive presentation.
- Handedness changes the microgame target/motion side and control placement where applicable.
- The browser layout presents a phone-like play surface while using browser-native accessibility and testing hooks.
- Interactive controls should have meaningful labels and roles. Resource and enemy bars expose values to accessibility tooling; room status and incoming-room snapshots support orientation and UI verification.

## 11. Non-functional requirements

### Determinism and correctness

- The same seed and floor must reproduce the same generated floor.
- Door boundaries must remain symmetric on both adjoining rooms.
- A generated floor must be connected and its placed progression items must be reachable under the rules that use them.
- Invalid actions must not mutate game state.
- Multiplayer resolution must not mutate the previous network snapshot and must produce stable results for a stable roster/action set.

### Responsiveness and pacing

- Common interactions should resolve without long blocking transitions.
- Timed play must use a shared source of truth for durations and game-loop cadence.
- Microgames must allow realistic human reaction time and make their target event visually apparent.
- Animation and timer constants belong in the shared tuning table rather than duplicated screen literals.

### Portability and maintainability

- Game rules should remain independent of browser and native presentation.
- Platform variants should preserve the same user-facing semantics.
- User-facing labels and descriptions should come from catalogs rather than duplicated ad hoc strings where practical.
- Important balance and generation parameters should be centralized.

### Privacy and connectivity

- Multiplayer currently exchanges session signaling data by user-mediated copy and paste.
- The app does not require a game server for local multiplayer and does not configure external STUN/TURN services.
- Connection state and failure should be understandable; peers can be removed and invited again from the lobby.

## 12. Architecture and important modules

| Area | Responsibility |
|---|---|
| `src/game/config/gameparameters.js` | Shared combat, map generation, item catalog, resource, timer, and animation tuning. |
| `src/game/config/game-classes.ts` | Class metadata, random run class selection, support descriptions, microgame association, and reserved test-seed classes. |
| `src/game/dungeon/generateDungeon.ts` | Seeded floor construction and reserved test corridor generation. |
| `src/game/dungeon/rooms.ts` | Room lookup, movement, visibility, item operations, door operations, and enemy placement. |
| `src/game/actions/` | Action definitions/validation, item effects, and microgame timing/scoring. |
| `src/game/engine/` | Combat, movement, turn timing, the shared single-player loop driver, multiplayer resolver, and state snapshots. |
| `src/game/state/` | Game state types, reducers, initial values, and animation/number stores. |
| `src/components/` | Shared visual components and selected web-specific variants. |
| `src/app/` | Native routes and Expo application shell. |
| `app/page.tsx`, `app/RunScreens.tsx` | Next.js browser navigation shell and extracted setup/settings/single-player screens. |
| `src/multiplayer/` | WebRTC connection interfaces and platform adapters. |
| `tests/unit/` | Jest rule, state, component, and transport-boundary tests. |
| `tests/visual/` | Playwright browser-level layout, microgame, runtime, and full-run tests. |

## 13. Quality strategy

The test pyramid has three useful levels:

1. **Rule-level Jest tests:** cover deterministic generation, action validation, combat calculations, item recovery, random class assignment, turn timing, and multiplayer resolution. Prefer real rule modules and controlled RNG where repeatability requires it.
2. **Component/controller tests:** cover interactions and state transitions where a focused test adds value. Keep mocks at true boundaries such as browser/native services, human input, and RNG; avoid replacing the game logic under test.
3. **Playwright end-to-end tests:** run the real browser app, use accessible user-facing controls, control the clock for deterministic timers, and model human taps with realistic intervals. Reserved test seeds should support complete runs, including combat, item use, level transitions, and game-over behavior. CI installs Playwright-managed Chromium before running browser tests; local runs require that browser to be installed once.

Code changes should follow test-driven development: decide the design change, add or adjust a failing behavior test, make the smallest implementation change that passes, and repeat until the behavior is covered. CI runs lint, TypeScript checking, Jest, and the browser suite. Browser tests require a working Next.js build/server, an installed Playwright Chromium, and an available local port; the local visual server can be selected with `PLAYWRIGHT_PORT`.

## 14. Current constraints and future considerations

- The web page shell still owns navigation state for title, setup, settings, gameplay, multiplayer, and game over. Setup, settings, and single-player UI now live in `RunScreens.tsx`; moving screen state to route-level navigation remains a possible follow-up.
- Native and web use the same timer driver and rules, but each shell still owns its screen composition and lifecycle. Changes to screen behavior still need platform parity review.
- Playwright configuration defaults to bundled Chromium, reuses a working local visual server outside CI, and CI installs the browser before executing the full visual suite. Local browser runs need a free port and host permission for Chromium to reach the local Next.js server. The checked-in full-run suite currently has a route-efficiency gap: it can spend the Hard action budget while collecting items and fighting before reaching Level 2. Its driver now uses each class's actual microgame, including 250 ms response timing; improve its route planning while keeping its item, Werewolf, ordinary-enemy, and Level 2 assertions.
- The multiplayer connection flow relies on manual signaling and local network reachability. A signaling service, QR exchange, STUN/TURN configuration, host migration, and active-run rejoining are future product decisions rather than current requirements.
- Multiplayer assigns one randomly selected class to every player in the run. Per-player class variety would need lobby UI, a protocol field per peer, and tests that verify each peer receives and uses its own class. This should precede a broader multiplayer balance pass if class variety becomes a requirement.
- Runs are not saved or resumed; quitting explicitly discards the current run. Adding resume requires a checkpoint format, migration rules, and a product decision about whether to resume automatically or from the title screen.
- The settings expose reduced motion and system appearance, but a full accessibility audit is still needed across screen-reader flows, contrast, focus behavior, and microgame alternatives. In particular, skill microgames need an equivalent accessible input mode so timing or pointer precision does not block play.
- Localization, analytics, and cross-device accounts remain out of scope. Analytics and accounts would add data handling and service dependencies that the current local-first design does not require.

### Recommended order for the remaining product constraints

1. Stabilize the full-run route driver and complete the three-class Level 2 runs with item use, Werewolf combat, ordinary enemies, and realistic class microgames. Keep this as the release regression for the current core loop.
2. Add per-player multiplayer classes and a lobby before changing multiplayer balance. Add signaling/reconnection and host migration only after choosing the expected network topology and service budget; these choices change deployment, privacy, and support costs.
3. Define run checkpoint data and a resume/abandon flow before implementing persistence. Version saved runs so game-rule changes can reject or migrate older checkpoints safely.
4. Add accessible alternatives for microgames and verify screen-reader labels, focus, contrast, and reduced-motion behavior on both shells.
5. Revisit localization, accounts, and analytics only when a concrete audience or product requirement needs them; each introduces content, privacy, and service maintenance work.

## 15. Acceptance criteria for future changes

A change is ready when:

- its intended player-visible behavior and design effect are stated;
- a test fails for the missing behavior before implementation begins;
- the implementation is the smallest change that makes the test pass;
- relevant existing Jest tests pass, and browser tests are run when their UI behavior is affected and the browser environment is available;
- native and web behavior are checked for parity when the change touches shared gameplay or UI;
- user-facing copy, help text, and this design document agree with the implemented rules.
