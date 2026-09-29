# Shared game code

Both the Expo Router app and the Next.js app import the same game modules from this directory.

- `engine/` contains movement, targeting, combat, turn resolution, and the React controllers that connect those rules to the screens.
- `state/` owns shared state types, initial state, and combat animation state.
- `dungeon/` contains dungeon types, generation, and room/map operations.
- `actions/` defines player actions, validation, and item effects.
- `entities/` contains player, enemy, and item models and factories.
- `../utils/` contains shared random and coordinate helpers.
- `config/` contains game rules and class data.
- `data/` contains authored dungeon data.

Keep platform-specific rendering and networking adapters outside `game/`. Multiplayer message/connection logic lives in `../multiplayer`; screens live in the app router directories, and shared UI components live in `../components`.
