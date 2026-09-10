# Room rendering

Gameplay owns rooms, doors, inventory, and combat outcomes. Visual ticks live in
`createSceneFrameStore`; only the scene panel subscribes to them. The gameplay
clock continues to determine action timing. Animation must never move a character
between logical rooms or apply damage itself.

The scene uses a 384 × 240 logical surface, scaled uniformly to its measured
viewport. `floorLayer` accepts artwork in these coordinates, behind walls and
actors. Future tile renderers and camera transforms should use this same surface.
Pixel assets and walking transitions are not implemented yet.

`layoutRoomActors` assigns disjoint slots by location, with stable entity IDs.
Groups occupy separate regions; crowded groups wrap and shrink. The 64-unit
envelope accommodates a 32-unit sprite, combat travel, bounce, and its health bar.
Effects are clipped to their slot so they cannot cover a neighbor. Future sprite
sheet frames must fit this envelope. Additional PCs can be supplied as actors with
`kind: "player"`; networking and remote-player actions remain separate work.

For future walking animation, retain outgoing and incoming room visual snapshots
and animate presentation coordinates independently of the committed game state.
Do not interpolate arbitrary actors directly through occupied slots: reserve the
whole movement path or sequence movement, and honor reduced-motion settings.

Generation uses `placeItem`, which rejects rooms already containing items. Runtime
`addItemToRoom` intentionally permits multiple items. Doorway guards are a list
when querying a boundary; a door opens only after its last living guard is defeated.

Run `node scripts/verify-scene.cjs` for pure generation, guard, layout, and frame
subscription checks without loading the native Expo test runtime.
