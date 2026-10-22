# Dungeon Run — Game Design and Remake Specification

**Document purpose:** this is the product and gameplay specification for rebuilding Dungeon Run without access to its source code. It describes observable player-facing behavior, the rules and content needed to reproduce a run, presentation requirements, and the current product boundaries. It is intentionally more detailed than a repository README.

**Status:** specification of the current game as implemented in the repository reviewed on 2026-10-09. “Current rule” means behavior evidenced by the current implementation. “Open decision” means the game does not provide a sufficiently consistent or complete answer; a remake should not invent a rule and claim it is original. Tuning values are collected in §6 and §7. If prose and a table conflict, the discrepancy is explicitly identified in §18.

## 1. Product definition

Dungeon Run is a compact, turn-based dungeon adventure for mobile devices and web browsers. One player controls a randomly assigned hero through a connected dungeon, room by room. Each action advances enemy behavior and spends one turn. Combat asks the player to complete a short timing or tapping challenge; the result determines damage. The player manages health, energy, one carried item, and one equipment slot, then finds stairs to continue to the next floor. Normal and Hard runs have per-floor turn budgets; Hard also imposes a per-action timer. Easy removes the run-wide turn deadline.

The game also has a same-local-network multiplayer mode. Multiple devices take simultaneous team turns in one shared dungeon, with a host-authoritative resolver. The game is intended to be playable without an account or persistent online service.

### 1.1 Player promise

- A run can start quickly, with a difficulty choice and optional dungeon seed.
- The same seed reproduces the same map for a given level. Ordinary runs choose the class randomly; seed-based layout replay does not ordinarily force a class.
- Exploration is spatial and visual: exits, walls, locks, guards, room contents, and stairs are shown in a room scene and a compact map.
- Combat is interactive. A score of 0–100 from the class microgame scales attack effectiveness.
- Items have automatic situational effects. The carried item is visible and can be dropped or replaced.
- A floor transition restores the player’s health and energy, preserves the carried item and equipment, increases the level, and provides a newly generated map.

### 1.2 Product principles

1. **Rules are legible.** The current room, possible exits, threats, resources, turn budget, and available action should be easy to understand.
2. **Skill affects outcome, without demanding inhuman timing.** Microgames account for a 250 ms human reaction allowance and provide a visible cue/target.
3. **Navigation is deterministic and solvable.** Seeded floors are reproducible; doors agree on both sides; required progression items are reachable.
4. **Choices carry opportunity cost.** One item slot and one equipment slot require tradeoffs; charging consumes energy except for specified free-action refunds.
5. **Shared game semantics across platforms.** Native and browser implementations may use different presentation details, but not different game rules.

## 2. Scope and non-goals

### In scope

- Title, setup, class briefing, gameplay, pause/settings, map, game-over, and multiplayer lobby/run flows.
- Three classes, three attack microgames, items, equipment, five enemy types, procedural floors, and difficulty settings.
- Local persistence of settings; deterministic seed-based floor generation.
- Same-Wi-Fi multiplayer using manual signaling exchange and WebRTC.
- Reduced motion, appearance, vibration, handedness, responsive layout, and accessibility labels.

### Not currently in scope

- Accounts, cross-device cloud saves, run resume, leaderboards, analytics, localization, purchases, campaigns, narrative quests, server-hosted matchmaking, active-run rejoin, host migration, or automatic peer discovery.
- A declared maximum floor or ending. The intended long-run campaign length and post-Level-2 difficulty curve are not specified.
- An alternative non-timed interaction for users unable to use the microgames. This is a known accessibility gap, not a solved requirement.

## 3. Platforms, sessions, and persistence

### 3.1 Browser

The browser client is a Next.js application. It presents a phone-like play surface centered in the page and uses React Native Web-compatible shared components. A page-level navigation state switches among title, setup, settings, single-player, multiplayer, and game over. A browser refresh starts from the title and does not restore an active run.

### 3.2 Native

The native client is an Expo / Expo Router application. It uses React Native components, native route navigation, persistent settings through AsyncStorage, and optional vibration feedback. Native WebRTC multiplayer requires a development or production build; Expo Go does not include the native WebRTC capability.

### 3.3 Persistent data

Only user settings are persisted. The settings object contains:

| Setting | Values | Default | Effect |
|---|---|---|---|
| Difficulty | Easy, Normal, Hard | Easy | Run-wide turn budget and Hard action timer. |
| Seed | Text; blank means generated | Blank | Deterministic floor layouts. |
| Appearance | System, Light, Dark | System | Theme selection. |
| Vibration | On / Off | On | Native damage feedback; browser does not vibrate. |
| Handedness | Right / Left | Right | Microgame motion/target placement and relevant control arrangement. |
| Reduce motion | On / Off | Off | Suppresses selected scene movement and idle animation; also respects platform preference. |

Invalid or missing stored fields fall back individually to defaults. Browser storage is local storage; native storage is AsyncStorage. Runs are not persisted. Leaving/refreshing the game loses the run.

## 4. Screen-by-screen experience

### 4.1 Title

Show the game title, the prompt “How would you like to play?”, a **Singleplayer** action, a **Multiplayer · Same Wi-Fi** action, and short multiplayer context. Choosing a mode moves to setup and populates the seed field with a generated non-reserved seed. The player can still replace it with typed text.

### 4.2 Run setup

Show difficulty selection as three options, an editable Seed field, help for difficulty and seed, Settings, Back, and Start. Difficulty help explains: Easy is casual; Normal requires clearing each floor within a turn budget; Hard has the same turn budget plus a timer on every turn. Seed help explains that it determines floor layouts. A blank/whitespace seed is replaced with a generated seed when Start is pressed. The seed is trimmed before use.

### 4.3 Class briefing

Every new run selects Warrior, Cleric, or Thief randomly, except reserved development/test seeds (see §10.4). The briefing identifies the class and has two pages:

1. Support action and class special ability.
2. Attack microgame instructions, example visual, displayed attack damage, Practice, Back, and Start.

Practice runs the real microgame and does not attack an enemy or spend a game turn. Starting closes the briefing and begins play. The class briefing is also shown before a multiplayer team run; each client acknowledges before entering play.

### 4.4 Gameplay surface

The play screen is composed in this order, with compact layouts allowed to hide optional labels/map details while preserving essential actions and state:

- Menu button.
- Turn-status text, including test marker where applicable, room, level, and combat/clear status.
- Dungeon map (can be opened from menu on very short layouts).
- Equipment and item controls, plus Charge Up. Their left/right order follows handedness.
- Health and Energy bars; Hard additionally shows a countdown bar.
- Short action instructions on layouts with room.
- Room scene: hero, visible room actors/loot/stairs, and directional exits.
- Microgame overlay when a player attacks.

The principal room actions are: tap a monster to attack, a room item/equipment to pick it up, a doorway to move/open it, the hero to use class support, or stairs to descend. During resolution, menu-independent actions are disabled so a repeated tap cannot submit duplicate actions.

### 4.5 Menu and map

The in-game menu offers appearance, vibration, reduce motion, Practice Attack, Back to Game, Quit to Title, and (on tiny layouts) Dungeon Map. Quit asks for confirmation and states that the current run will be lost. The map dialog has a Close map action.

### 4.6 Game over

Show “Game Over”, the score, and Return to Title. The score is the count of floors successfully cleared. Clearing Level 1 and dying or timing out on Level 2 displays Score: 1. No continue/retry button is currently provided.

## 5. Game loop and state model

### 5.1 Run state

At minimum, a remake needs the following run state:

| State | Meaning |
|---|---|
| Level | Current floor, starting at 1. |
| Cleared levels | Number of floors completed; score on game over. |
| Dungeon map | Grid cells, active rooms, boundaries, visibility, room contents, entity records, start location, and floor number. |
| Player location | Exactly one current room in single-player. |
| Health / Energy | Each starts at 100; values are clamped to valid bounds. |
| Carried item | Zero or one item. |
| Equipment | Zero or one equipment item. |
| Turns remaining | Floor-local budget for Normal/Hard; Easy has no active limit. |
| Turn number / timer | Identifies each action and drives the Hard countdown. The countdown resets when turn or level changes. |
| Charge state | Whether Charge Up has reserved energy for the next action. |
| Temporary class effects | Defense buff duration and Warrior retaliation state. |
| Werewolf encounter state | Whether the Werewolf has been encountered and therefore chases after actions. |

### 5.2 Single-player action transaction

1. The player selects/taps an action. The interface disables incompatible inputs while resolution is active.
2. The game validates the target and conditions against current state. Invalid actions do not change the map or consume a turn.
3. For attack, the class microgame runs first. When the player submits or times out, the score resolves the hit.
4. Player effects and animation play. If the player remains in the same room with living targetable enemies, those enemies attack sequentially.
5. After an action, applicable equipment damage, item recovery, Werewolf chase, buff/retaliation expiry, and turn-budget loss resolve according to §7–9.
6. The next turn begins and its countdown is reset. Level changes also reset the countdown, even if turn duration may later be tuned independently.

Movement away from a room with enemies avoids their attacks; a non-movement action in the same room allows all targetable living enemies to attack. An attack that defeats all local enemies ends hostile responses for that turn. If an attack fails to kill the enemy, it attacks back. Movement through a guarded boundary is unavailable until its guard is defeated.

### 5.3 Terminal conditions

A run ends when player health reaches zero without a saving effect, or when a Normal/Hard turn budget reaches zero without a Clock rescue. A Clock is consumed at the budget boundary and adds `5 + current level` turns. Easy has no run-wide turn-out condition. A player can quit at any time through the confirmed menu flow.

## 6. Numeric tuning reference

Values below are current implementation values and should be centralized in a remake so balance changes are auditable.

### 6.1 Player baseline

| Parameter | Value |
|---|---:|
| Maximum Health | 100 |
| Maximum Energy | 100 |
| Base attack | 10 |
| Base defense | 10 |
| Warrior starting defense | +5 (total 15 before equipment/buffs) |
| Default Charge Up energy cost | 10 |
| Health Potion / Stamina Meal recovery | 50% maximum (50 points) on lethal/zero threshold, not a freely activated heal |

### 6.2 Difficulty and action time

| Difficulty | Run-wide turn limit | Visible action countdown | Initial duration | Per-level reduction | Minimum |
|---|---|---|---:|---:|---:|
| Easy | None | No | 6,000 ms timing value | 30 ms | 2,000 ms |
| Normal | Yes | No | 6,000 ms timing value | 30 ms | 2,000 ms |
| Hard | Yes | Yes | 5,000 ms | 30 ms | 2,000 ms |

The turn budget on a limited floor is `max(1, activeRoomCount × 4)`. Active rooms include revealed/occupied rooms and rooms connected by open or guarded edges. An expired Hard countdown forfeits the player action, advances one turn, and still resolves the room’s enemy response. Normal does not expose the action countdown, though the shared turn-time state has the listed six-second duration. Animation/game-loop frame cadence is 100 ms. The display updates in 100 ms increments, rounded upward.

Room transitions last 220 ms. Player attack animation is 500 ms with impact at 250 ms. Enemy turn animation/response is 500 ms with incoming damage feedback at 250 ms. Other current timing values: bounce 1,400 ms; damage feedback 248 ms; resource-loss feedback 680 ms. These are presentation timings, not additional turns.

### 6.3 Score

For every completed floor, add one to `clearedLevels`. The game-over score is this value. No points for enemies, items, or time are currently defined.

## 7. Classes, abilities, and charging

Each run has one class. Ordinary seed text does not select the class. A seeded class selection exists only for reserved test seeds to make tests reproducible. Classes share the same baseline health/energy and use distinct support, passive/special, and attack microgame rules.

| Class | Passive/special | Support (uncharged) | Support (charged) | Attack microgame |
|---|---|---|---|---|
| Warrior | Starts with +5 defense. | Vanguard lasts for one turn; enemies that attack trigger reflected damage to an attacker. | Also gains +5 defense for that turn. | Multitap |
| Cleric | Miracle: if lethal damage occurs, no Health Potion saves the player, and Energy is positive, consume all remaining Energy and survive with Health equal to the Energy amount. | Aid grants +5 defense for two turns. | Also restores up to 10 Health. | Concentration |
| Thief | Can pick locked doors without a Key. | Enrich: 10% chance to generate a random item or equipment. If its corresponding slot is occupied, the reward is dropped in the current room. | Chance rises to 20%. | Timed Attack |

### 7.1 Charge Up

Charge Up is a toggle, not a separate turn. Turning it on immediately reserves the equipment-adjusted charge cost from Energy. Toggling it off refunds the reservation. It can only be turned on if enough Energy remains. Charge changes the next eligible action:

- Attack: uses the charged attack profile; charge cost is normally consumed.
- Support: applies the charged support variant. The charge is consumed; it is not refunded.
- Move or pick up: the action can be resolved as charged but its charge is refunded afterward (a “free action” charge use). A charged Thief lockpick opens and moves through the lock as one action; its charge is refunded in the movement path.
- Invalid or cancelled actions must not leave a charge reservation stranded.

The charge control’s implementation-level description currently says “1 energy” even though the rule uses 10 by default and equipment can reduce it to 5 or 2. A remake should display the actual numeric cost; see §18.

## 8. Microgames and combat scoring

### 8.1 Shared contract

When attack microgames are enabled, each player attack against a monster runs the current class microgame and returns a score in `[0,100]`. When disabled, the attack resolves directly at full score without a tutorial or extra start step. Microgames use a monotonic clock, complete at most once, and return score 0 on timed-out single-tap challenges. The player’s tap is treated as a human input; do not silently auto-perfect the score. A 250 ms response is the design reference for a human reaction time. Silver Bullet attacks bypass the microgame.

### 8.2 Concentration (Cleric)

- A filled circle moves toward/through a stationary outlined target.
- The target crossing is visually shown; a tap ends the game.
- Overall window: 1,500 ms. Intended visual travel: 1,250 ms; the remaining 250 ms represents reaction allowance.
- The player’s measured time is adjusted by subtracting 250 ms before scoring.
- `score = clamp(round(100 − abs(adjustedTapMs − targetCrossingMs) × 100 / 500), 0, 100)`.
- Each run randomizes target timing/position (the current implementation selects a target parameter in a 200–600 ms range and moves the spot based on handedness). A tap earlier or later reduces score linearly; an input 500 ms from the ideal corrected time scores 0.
- Handedness changes which side the target/motion favors. The visual target and hit box must remain aligned.

### 8.3 Timed Attack (Thief)

- Show an instruction to wait for the cue; “NOW!” must not appear at the beginning of the wait.
- Cue appears 1,000 ms after the microgame starts.
- Intended input: tap 250 ms after the cue.
- Total scoring window: 1,750 ms from start (cue + reaction time + 500 ms tolerance).
- Measured cue-relative time is adjusted for 16 ms scheduling tolerance in browser tests, not by the game rule.
- `score = clamp(round(100 − abs(tapMsAfterCue − 250) × 100 / 500), 0, 100)`.
- Input at cue time (anticipating the human reaction) scores 50, rather than perfect. Inputs 500 ms or more away from ideal score 0.
- “NOW!” text and accessible game screen button must appear together; the cue must be visible just before the expected tap.

### 8.4 Multitap (Warrior)

- A visible circular target changes position after each tap. Tap it as quickly as possible.
- Each tap contributes approximately 16.67 points. Score is `clamp(round(taps × 100 / 6), 0, 100)`.
- Six taps completes immediately with score 100. If the timer expires first, score is the accumulated tap score.
- Window: 3,000 ms. The duration stays fixed; target tap count and score per hit are tuned to fit it.
- Browser end-to-end input should space taps by about 250 ms to model a realistic player. Input outside the target is not a successful tap.
- Handedness affects target placement/movement direction.

### 8.5 Attack damage

Base attack damage before microgame score and equipment:

| Target | Uncharged raw profile | Charged raw profile |
|---|---:|---:|
| Ordinary monster | 10 | 20 |
| Werewolf | 0 (immune) | 0 (immune) |

Ordinary attack calculation is `max(1, floor(profile × score / 100)) + equipmentAttack + (charged ? 5 : 0)`, then subtract target defense and clamp at zero. Thus the displayed raw profiles omit equipment and, for charged attacks, the extra +5 modifier. The Werewolf takes no damage from normal or charged attacks. Silver Bullet against a Werewolf deals its remaining health and is consumed. Ordinary enemies have defense 0 in the current catalog.

The game applies actual damage no greater than the target’s remaining HP. Player damage is calculated after class defense, equipment defense, and temporary defense are summed. Incoming damage is `max(0, enemyDamage − totalPlayerDefense)`. Damage cannot heal either party.

## 9. Items and equipment

There is one carried item slot and one equipment slot. Picking up an item while carrying one swaps the carried item with the room item; the previous carried item is left in the room. Equipment behaves similarly. Items/equipment are activated through their trigger conditions, not a general “use now” button. The inventory controls expose labels/descriptions and let the player drop an item or equipment into the current room.

### 9.1 Items

| ID / display label | Effect | Consumption |
|---|---|---|
| `energy-meal` / Stamina Meal | When Energy reaches zero, restore 50 Energy. | Consumed when triggered. |
| `health-potion` / Health Potion | On otherwise-lethal damage, restore 50 Health. | Consumed when triggered. |
| `key` / Key | Opens the next locked boundary the player attempts to cross; ordinary classes move through in the same action. | Consumed on unlock. Thief does not consume it to pick a lock. |
| `silver-bullet` / Silver Bullet | On attacking a Werewolf, instantly defeats it. | Consumed on use. |
| `clock` / Clock | When a limited run would reach zero turns, grants `5 + current level` more turns. | Consumed at the boundary. |

### 9.2 Equipment

| ID / label | Attack | Defense | Other effect |
|---|---:|---:|---|
| Good Armor | 0 | +5 | None |
| Good Weapon | +10 | 0 | None |
| Heavy Armor | −5 | +10 | None |
| Heavy Weapon | +30 | −5 | None |
| Amulet | 0 | 0 | Charge cost becomes 5 Energy |
| Cursed Amulet | 0 | 0 | Charge cost becomes 2 Energy; lose 1 Health after each turn |
| Spyglass | 0 | 0 | Reveals rooms adjacent to the current room on the map |

The Cursed Amulet’s description is hidden when found on the floor; after equipping, its actual modifiers should be communicated. Its recurring health loss occurs after each resolved turn and can trigger potion or Cleric Miracle survival. Equipment loss on replacement/drop is handled by placing it in the room, not deleting it.

## 10. Dungeon, exploration, and progression

### 10.1 Map and rooms

- World grid: 12 columns by 6 rows (room IDs use a letter and number, such as `A1` through `F12`; rendered axes follow the game’s row/column mapping).
- A floor activates a connected subset of grid cells. It starts with `7 + level + random integer [0,4]` rooms, subject to the 72-room and grid-size caps.
- Room growth adds one orthogonally adjacent room at a time, keeping the active graph connected. Then some additional loops may be added (chance 25% for each sampled eligible edge).
- Each room boundary is `wall`, `open`, `locked`, or `guarded`. Shared boundaries must be symmetric.
- Start room is selected from the grid unless a transition supplies a starting position. Only the start is revealed initially. Entered rooms stay revealed. Spyglass reveals neighboring cells.
- A non-start room receives stairs. Stairs are represented as a room actor and can be tapped to descend.
- The map legend identifies current room, monster, item, stairs, and explored rooms. Door/lock/guard glyphs communicate boundaries. Unrevealed locations do not show contents.

### 10.2 Generation order and solvability

For reproducibility, generation uses a deterministic pseudo-random stream derived from normalized seed and level. Each level gets an independent derived stream so unrelated random calls do not affect it. The current conceptual order is: create empty grid/start, grow connected network, add extra connections, place doorway guards, place stairs, place a lock and reachable key if selected, place Werewolf and Silver Bullet if selected, then place optional loot/equipment. The map must remain connected and all required placed progression objects must be reachable. The locked connection is selected among open connections; if a lock is created, the Key is placed on the reachable side before the boundary is locked.

Room count formula: `min(72, 12 × 6, 7 + level + floor(random × 5))`. A candidate edge has a 70% chance to be locked when there is an eligible connection. Doorway guards are capped at the number of open connections and target half the active room count (current placement count is bounded by actual connection count). Werewolf placement chance is 45% among eligible reachable, non-start, non-stairs, unguarded rooms. If placed, a Silver Bullet is placed in a different reachable room. Optional loot placement chance parameters are 10% for items and 6% for equipment; specific floor counts derive from floored candidate count, and not every floor is guaranteed to have optional loot. These chances/count formulas are separate from the required key/bullet progression placement.

### 10.3 Movement and boundaries

- Tap an open doorway to move one orthogonal room. Update current room and reveal it.
- Wall: no action, no turn.
- Locked doorway: ordinary class needs Key; key opens the symmetric boundary, is consumed, and movement proceeds. Thief picks without a key; an uncharged pick opens the lock but leaves the Thief in place, so it costs a turn. A charged Thief pick opens and moves in one action.
- Guarded doorway: cannot cross until the guard is defeated. The guard is a targetable monster attached to the shared edge; defeat opens the edge from both rooms.
- If entering a room with stairs on level transition, place the player at room center.
- Once the Werewolf has been encountered, it relocates to the player’s room after subsequent actions (including actions that would otherwise leave it behind) until defeated. A move/action ordering must avoid cloning or losing the single Werewolf entity.

### 10.4 Reserved deterministic test seeds

The case-insensitive exact normalized seeds `test`, `testwarrior`, `testcleric`, and `testthief` are development fixtures, not ordinary player seeds. All four pin Level 1 to the same authored single-corridor route and content. The class mapping is Warrior for `test` and `testwarrior`, Cleric for `testcleric`, and Thief for `testthief`. The route contains, in order after the start: the five catalog items with Key first, three Pixel Golems guarding successive doorway boundaries, a Werewolf, and stairs; a locked passage is positioned after the key. Level 2 uses normal seeded generation. These exact test seeds are reserved by the UI seed generator and may be special-cased in class selection and map construction.

### 10.5 Level transition

Descending increments `clearedLevels` and `level`, generates the next floor from the same seed plus new level, restores Health and Energy to 100, clears temporary buffs/charge/encounter state and transient damage feedback, preserves carried item and equipment, resets the turn budget for the next map, and resets action duration based on the new level. The player enters at the supplied/selected starting position, normally centered on the new floor’s starting room. The next floor contains its own stairs. No level cap is specified.

## 11. Enemies

| Enemy | Maximum HP | Damage per attack | Special behavior |
|---|---:|---:|---|
| Pixel Golem | 25 | 22 | Ordinary enemy. |
| Zombie | 45 | 24 | Ordinary enemy. |
| Dragon | 70 | 28 | Ordinary enemy. |
| Vampire | 55 | 25 | Ordinary enemy. |
| Werewolf | 55 | 27 | Chases after encounter; Silver Bullet instantly defeats it. |

Enemy base stats apply on Level 1. For each later level, damage and attack values increase by 20% of their Level 1 value and maximum Health increases by 12% of its Level 1 value, rounded to the nearest integer. A floor transition restores full Health, but every new floor increases the threat again.

All ordinary enemies currently have zero defense. Enemies in a room attack in target order, with Werewolf sorted after ordinary targets. Multiple enemies may attack in one response. Doorway guards use ordinary monster generation and block the passage they guard. Enemies are defeated at zero HP and are no longer targetable. A defeated guard opens its passage once no other living guard remains on that same edge.

## 12. Visual design and interaction specification

### 12.1 Visual language

The game uses a pixel-art dungeon and character/enemy sprites, with a parchment/sepia UI palette and distinct semantic colors for health, energy, timer, accent, and map cell types. Sprites come from the bundled 32 rogues asset set and app-provided game sprites. The interface should retain crisp pixel presentation rather than smoothing sprites into photographic illustrations.

### 12.2 Room scene

Render a room panel containing the player near the center (or at a directional entry position), room actors, and four potential directional boundary controls at the edges. Boundary state determines the visible and interactive element. Room actors include enemies with health indication, item, equipment, and stairs. Each tappable actor exposes a meaningful accessibility label and button role. The scene snapshot and current room status should remain coherent while the outgoing/incoming room transition animates.

The current visual dimensions are responsive. Gameplay shell uses compact layout; below 800 px height the map is compacted, below 500 px height the map is hidden until opened and explanatory text is reduced. Briefing compacts below 600 px. A remake may adapt thresholds to its layout system but must preserve essential actions and state visibility.

### 12.3 Map

Show a grid aligned to the dungeon’s 12×6 world. Only revealed rooms are drawn as occupied rooms; the current room is visually distinct. A room may be color-coded by priority: current location, stairs, monster, item/equipment, explored. Doorways show open connection, locked icon, or guard icon. Include a legend unless the screen is very short. Accessibility labels should disclose room ID and visible contents without exposing hidden rooms.

### 12.4 Microgame presentation

Overlay the play area without losing context. Instructions and target should be clear at a glance. Timed Attack’s `NOW!` cue appears exactly after its delay and before the intended response. Concentration target/mover must have enough contrast and precise geometric alignment. Multitap target must visibly move after successful taps. Hit areas must be at least as large as the visible target. Left-handed mode should reposition/mirror where practical without changing scoring.

### 12.5 Feedback, motion, and accessibility

- Show numerical/stat bars with accessible current/max values and labels (Health, Energy, enemy HP, turn timer, turns remaining).
- Buttons need accessible names, roles, and disabled/selected state where applicable.
- Show incoming damage and resource-loss feedback; optionally vibrate on native damage if enabled.
- Reduced motion skips room slides, doorway pulsing, and idle enemy bobbing. It should not hide state changes or disable interaction. Platform reduced-motion preference is combined with the in-app setting.
- Appearance follows System, Light, or Dark. Text and interactive state must remain distinguishable in each theme.
- Left-handed controls relocate the Charge / inventory arrangement and microgame interaction side.
- Known unmet accessibility goal: provide an equivalent mode for players who cannot use time/precision-based microgames; see §17.

## 13. Multiplayer specification

### 13.1 Lobby and connection

The player selects Multiplayer from title and passes through the same setup screen. One device hosts and controls difficulty/seed; a guest pastes a host invitation, creates a reply, and returns it to the host. The host accepts or cancels each pending invitation, can remove connected/lobby players, and starts when ready. Signaling data is copied and pasted by the users. Every peer must be on the same local network and the host must remain foregrounded. No automatic discovery, signaling service, configured STUN/TURN servers, host migration, or active-run rejoin exists.

### 13.2 Shared run model

The host is authoritative for dungeon and shared enemy/door state. Each player has an ID, current room, Health, Energy, carried item, equipment, class ID, defense buff, and Warrior retaliation state. The roster currently receives one randomly selected class shared by all players. Each peer has its own position and resources; dungeon layout and enemies are shared.

### 13.3 Team turns and resolution

Living players submit one action each. The host resolves actions in stable roster order, making contested item pickup deterministic. Easy and Normal wait for all living players. Hard uses the host’s countdown; missing players’ actions are skipped and enemies still act. All surviving players must reach stairs before the party descends. Fallen players spectate and revive on the next level. Run ends when all players fall or the shared turn budget expires. A host disconnect/foreground loss may stop the run; the UX should clearly say the host controls timing and state.

Actions include movement, attack with score, pickup, descent, support targeting self or a co-located ally, and equipment drop. Test seeds pin the class for repeatable testing. Transport tests may replace the native WebRTC boundary; gameplay resolution tests should exercise real shared rules.

## 14. Game architecture for a faithful remake

This section is implementation guidance, not a requirement to use the same libraries. Keep rules deterministic and platform-neutral so visual shells can be rebuilt independently.

### 14.1 Suggested modules

1. **Content catalogs:** classes, enemies, items, equipment, animation and timing constants.
2. **Seeded dungeon generator:** PRNG, graph construction, boundaries, reachable progression placement, visibility, and test fixtures.
3. **Pure rules:** action validation, movement, item triggers, charge, combat math, turn/clock resolution, class effects, level transition, multiplayer action resolution.
4. **Run state/controller:** canonical state reducer and orchestration of rule transitions; no UI dependencies.
5. **Presentation:** app shell/navigation, settings, HUD, map, room scene, microgame overlays, dialogs.
6. **Adapters:** storage, timer/clock, haptics, platform capability, WebRTC, and human input.

### 14.2 State integrity

Treat an action as a state transition with explicit effects and outcome. Invalid actions leave state unchanged. A seeded generator must be independent per `(normalized seed, level)`. Map updates should be immutable or otherwise preserve prior snapshots where multiplayer/network state needs comparison. Boundary updates must always change both sides. Generated maps must pass structural and reachability invariants before play begins.

### 14.3 Timing and randomness

Use a monotonic clock for microgame elapsed time and a single run-loop owner for Hard timing. A timer starts/restarts on either turn-number change or level-number change. Pause/microgame/menu states must have an explicit timer policy; current single-player pauses the countdown while menu or microgame is active. Keep RNG injectable at game creation and partitioned by purpose/level to permit deterministic replay, but do not substitute mocked game rules in gameplay tests.

## 15. Sound and haptics

No sound system or sound catalog is specified in the current app. Do not invent sound as existing behavior. Vibration is a setting; on native clients, enabled damage response uses medium-impact haptic feedback. Browser clients do not vibrate. A future sound design requires a separate product decision.

## 16. Quality and verification requirements

### 16.1 Rule and generator tests

Verify exact combat math, class effects, charge cost/refund, equipment modifiers, all item triggers, item-slot swap/drop, door symmetry, Thief lock flow, guard defeat/opening, Werewolf chase and Silver Bullet, turn budget, Clock rescue, level transition, deterministic generation, and reachability. Control RNG only where a known randomized branch must be reproducible. Use real rule modules.

### 16.2 Microgame tests

Exercise the real microgame state/scoring with realistic human input. At minimum:

- Timed Attack: no cue before 1,000 ms; cue then visible `NOW!`; tap around 250 ms later scores near 100; anticipatory and late taps score lower; timeout scores zero; completion fires once.
- Concentration: target/mover geometry corresponds to the target progress; corrected 250 ms human response at crossing scores near 100; early/late response degrades linearly; timeout returns zero.
- Multitap: target relocates, each real tap adds ten points, ten taps reaches 100, timeout retains earned score, and 250 ms spaced input is achievable within the window.
- Both handedness layouts keep target and hit area aligned.

### 16.3 End-to-end tests

Browser tests should start from title and use visible accessible controls. Reserved fixture seeds may guarantee a route/content order. A complete Hard run should use realistic microgame input and demonstrate items, ordinary combat, Werewolf combat (and, where route permits, its bullet), class support, charged/uncharged class abilities, Thief lockpick without Key, Level 2, and eventual timeout/game-over. The end-to-end route must not exhaust its turn budget just collecting optional content; route planning should prioritize required assertions and use as many available test items as feasible. Tests should model approximately 250 ms reaction time instead of perfect instantaneous taps. Avoid mocks except at true outside boundaries such as storage, WebRTC, RNG control, and human input.

### 16.4 Accessibility and platform verification

Check native/web rule parity; themes; handedness; reduced motion; short viewports; keyboard/focus and screen reader names; timer visibility; text contrast; dialogs and quit confirmation; and haptics setting behavior. CI should run lint, type checking, rule tests, and browser visual/E2E tests with the required browser installed. Browser tests need a free local port and a working app server.

### 16.5 Test-driven change process

For every behavior change: (1) state the design-level change, (2) add/modify a behavior test that fails for the missing behavior, (3) run it to confirm the failure, (4) make the smallest implementation change that passes, and (5) repeat until the behavior is covered. Do not write implementation first and retroactively add a test. Tests should exercise production game logic as close to actual gameplay as practical.

## 17. Current constraints and future limitations

### Player experience

- The game does not explain every rule in a tutorial; the class briefing explains class-specific moves but there is no comprehensive glossary/tutorial flow.
- The single item and equipment slots create tradeoffs, but all loot does not have a dedicated inventory management screen.
- There is no run resume or save migration format.
- There is no explicit campaign ending, maximum level, long-term progression, or endgame balance contract.
- Microgames require timing or pointer precision and have no equivalent accessibility mode yet.
- Setup and pause menus expose settings but the settings UX is not a full accessibility/preferences center.

### Gameplay and balance

- Difficulty labels are described, but there is no formal expected completion rate or target run duration.
- Easy still uses enemy combat and microgames; it only removes the run-wide turn limit and visible action timer.
- Normal has a run-wide turn budget but no visible countdown, so the player sees turns remaining rather than seconds remaining.
- Optional item/equipment placement is not guaranteed per floor. A fixed route is available only for reserved Level 1 test seeds.
- Class selection is random in ordinary runs and cannot be manually chosen or rerolled.
- Class support has no cooldown; its opportunity cost is the turn/enemy response and, when charged, Energy.
- Werewolf chase behavior can pull it into the player’s current room after its encounter; its exact movement/pursuit presentation is minimal.
- Later-floor difficulty scaling is mostly timer shortening and room-count increase. No fully authored per-level enemy composition or content curve is specified.
- The base-stat, support, and attack descriptions have minor display/rules mismatches listed in §18.

### Multiplayer and operations

- Manual copy/paste signaling is cumbersome and error-prone.
- No STUN/TURN configuration means some NATs, guest networks, or client-isolated Wi-Fi prevent peer connections.
- Host is a single point of failure; no migration, rejoin, or durable lobby exists.
- All players share the same class, limiting cooperative variety.
- Host must stay foregrounded; background lifecycle handling and connection recovery are constrained.
- Native multiplayer cannot be validated with Expo Go; a native-capable build is needed.

### Technical and product boundaries

- Native and browser shells remain separate compositions and need parity checks when UI changes.
- Web navigation state is managed in one page component rather than route-level URL navigation for each game state.
- Settings persist, but current runs do not. Seed generation is client-local and not an account-level history.
- No localization, analytics, remote content updates, or user-generated sharing flow exists.
- The art asset license and all bundled asset provenance should be reviewed before redistributing a remake.

### Recommended roadmap decisions

1. Define an accessible non-timing attack alternative and test it with assistive technology.
2. Decide whether class choice/reroll, class-specific multiplayer roster, and/or difficulty selection for each player are desired.
3. Choose reconnect/host migration and signaling service requirements before adding online multiplayer infrastructure.
4. Define save/resume semantics, schema versioning, and whether a run resumes automatically.
5. Specify floor cap/ending, expected run length, enemy scaling, and a balance target for each difficulty.
6. Reconcile numeric UI descriptions with actual rules, then include all balance fields in the content specification.
7. Add a glossary and optional first-run tutorial only after deciding whether discovery should remain implicit.

## 18. Known implementation discrepancies and remake decisions

These are source-observed mismatches; a no-code remake should resolve them intentionally rather than assume the prose is already consistent.

1. **Charge cost label:** game rules charge 10 Energy by default (5 with Amulet, 2 with Cursed Amulet), while the Charge Up control says “1 energy.” The correct player-facing value should be the actual cost.
2. **Charged Thief lockpick cost:** ordinary charged movement and pickup refund charge after resolution. A charged Thief lockpick also refunds charge immediately in its movement path. Preserve this behavior when implementing the combined open-and-move action.
3. **Thief carrying a Key:** ordinary movement uses the Key for non-Thieves; Thieves pick locks and do not consume it. The fixture/test expects the Thief to open a lock with no Key. Keep the distinction explicit.
4. **Displayed attack damage:** class briefing shows `10 + equipment attack`; charged ordinary attacks, Werewolf profile, microgame score, and target defense can yield different actual results. Prefer display text that names baseline and charged damage separately.
5. **Multitap timing policy:** the prior implementation used a 4,500 ms window for ten taps. The current design shortens the window to 3,000 ms and reduces the perfect-score target to six taps; future tuning should fit interaction requirements by changing tap count/scoring before extending microgame duration.
6. **Microgame concentration parameters:** the microgame selects target position/delay, while the visual mover uses progress geometry. Verify that all position/delay variants align exactly before treating the target formula as a final design guarantee.
7. **Level transition start position:** descent computes a destination start position from the current exit location in the connected flow. The exact mapping between floors should be confirmed as intended; this spec requires a valid centered start room and does not promise the same grid coordinate unless the design chooses it.
8. **Procedural guards:** guard count targets half the active room count but is capped by unique open connections. The generated number can be lower than the nominal target.
9. **Random test fixture contents:** the test corridor explicitly creates three Pixel Golems, Werewolf, five items and stairs. Test “same dungeon as test” means identical Level 1 layout/content, with class selected by seed; it does not pin later levels.
10. **Timer behavior:** Hard’s action timer starts/resets on turn and level changes; it pauses while a menu/microgame/class briefing is active. Confirm pause semantics in any alternate UI before changing them.

## 19. Remake acceptance checklist

A remake claiming feature parity is ready for review when all of the following are true:

- [ ] A new player can choose Singleplayer or Multiplayer from the title and start a run from setup.
- [ ] Blank seeds become generated seeds; explicit seeds reproduce floor layouts; ordinary seeds do not pin class.
- [ ] All three classes have their specified briefing, passive/special, support, charge variant, and attack microgame.
- [ ] All five enemies, five items, and seven equipment entries behave as specified.
- [ ] A player has exactly one item and one equipment slot, with predictable swap/drop behavior.
- [ ] Movement respects walls, open edges, locks, keys, Thief lockpick, guards, stairs, and symmetric boundary state.
- [ ] Every floor is connected, progression items are reachable, and repeated `(seed, level)` generation is stable.
- [ ] Combat uses microgame score and attack/equipment/defense rules; enemies respond only when the player remains in their room.
- [ ] Health/Energy recovery items, Cleric Miracle, Clock, Cursed Amulet, and Werewolf/Silver Bullet triggers are covered.
- [ ] Easy, Normal, and Hard apply the correct turn budget/countdown behavior; timer resets on turn or level changes.
- [ ] Level transition restores resources, preserves inventory/equipment, advances score/level, and generates the next floor.
- [ ] Timed Attack `NOW!` appears at the correct time; realistic 250 ms input yields plausible scores in all three microgames.
- [ ] Reduced motion, handedness, appearance, vibration, responsive layouts, and accessible labels work without hiding rules.
- [ ] Multiplayer lobby, authoritative turn resolution, stable ordering, party stairs, fallen-player revival, and current connectivity limitations are clearly handled.
- [ ] Unit and browser tests cover actual rule flows with mocks restricted to external services, human input, and controlled randomness.
- [ ] Any differences from the open decisions or known discrepancies in §18 are documented as deliberate product choices.
