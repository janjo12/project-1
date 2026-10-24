# Test layers

- `tests/unit` contains component and game-logic tests. Keep slot visibility, item/equipment instructions, pickup-flight requests, and timer pause behavior here.
- `tests/browser` is the small Playwright gate for real layout, atlas sprites, map scaling, and representative singleplayer pickup flows. Run it with `npm run test:visual` (builds first) or `npm run test:smoke`.
- `tests/scenarios` keeps the longer browser journeys and broad viewport sweeps available without making them part of the quick visual gate. Run them with `npm run test:scenarios`.

Prefer assertions on visible state and semantic controls over fixed sleeps. Use `page.clock` only when the timer or animation timing is the behavior under test. Browser navigation should wait for `domcontentloaded`, then wait for the specific app surface the test needs.
