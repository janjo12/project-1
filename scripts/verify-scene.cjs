// Pure domain regression checks, independent of the native Expo/Jest runtime.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(name, parent = root) {
  let file = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(parent, name);
  file = [file, `${file}.ts`, `${file}.js`, path.join(file, 'index.ts')].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
  assert.ok(file, `Missing module ${name}`);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => load(name, path.dirname(file)), module, module.exports);
  return module.exports;
}
const generation = load('@/utils/dungeon-generation');
const domain = load('@/utils/dungeon-map');
const runtime = load('@/utils/dungeon-map-runtime');
const layout = load('@/utils/room-scene-layout');
for (let seed = 0; seed < 200; seed++) {
  for (const level of [1, 5, 20]) {
    const map = generation.createSeededDungeonMap(String(seed), level, undefined, true);
    for (const room of map.rooms.flat()) assert.ok(room.contents.filter(c => c.type === 'item').length <= 1);
  }
}
const map = generation.createSeededDungeonMap('guards', 1);
const guard = Object.values(map.entities.doorwayGuards)[0];
assert.ok(guard);
const monster = { ...map.entities.monsters[guard.monsterId], id: 'second-guard' };
const source = runtime.getRoom(map, guard.roomId);
const neighbor = domain.getNeighbor(source, guard.direction);
const neighborId = domain.getRoomId(neighbor);
const opposite = domain.oppositeDirections[guard.direction];
domain.placeDoorwayGuard(map, neighborId, opposite, monster);
assert.equal(domain.getDoorwayGuardPlacements(map, guard.roomId, guard.direction).length, 2);
assert.ok(runtime.getTargetableMonsters(map, source).some(m => m.id === monster.id));
const oneDead = runtime.damageMonsterInRoom(map, guard.roomId, guard.monsterId, 999);
assert.equal(runtime.getRoom(oneDead, guard.roomId)[guard.direction], 'guarded');
assert.equal(runtime.getRoom(oneDead, neighborId)[opposite], 'guarded');
const allDead = runtime.damageMonsterInRoom(oneDead, neighborId, monster.id, 999);
assert.equal(runtime.getRoom(allDead, guard.roomId)[guard.direction], 'open');
assert.equal(runtime.getRoom(allDead, neighborId)[opposite], 'open');
const dropped = runtime.addItemToRoom(runtime.addItemToRoom(map, source.id, 'key'), source.id, 'key');
assert.equal(runtime.getRoom(dropped, source.id).contents.filter(c => c.type === 'item').length, 2);
for (const count of [1, 2, 5, 20, 100]) {
  const actors = ['top', 'bottom', 'left', 'right', 'center'].flatMap(position =>
    Array.from({ length: count }, (_, i) => ({ id: `${position}:${i}`, position })));
  const slots = layout.layoutRoomActors(actors);
  assert.deepEqual(slots, layout.layoutRoomActors([...actors].reverse()));
  const boxes = Object.values(slots);
  boxes.forEach((a, i) => {
    assert.ok(a.size > 0 && a.x >= 0 && a.y >= 0);
    assert.ok(a.x + a.size <= layout.SCENE_WIDTH && a.y + a.size <= layout.SCENE_HEIGHT);
    boxes.slice(i + 1).forEach(b => assert.ok(
      a.x + a.size <= b.x + 1e-8 || b.x + b.size <= a.x + 1e-8 ||
      a.y + a.size <= b.y + 1e-8 || b.y + b.size <= a.y + 1e-8,
    ));
  });
}
const pair = layout.layoutRoomActors([{ id: 'a' }, { id: 'b' }]);
assert.equal(pair.a.y, pair.b.y);
assert.ok(pair.a.x < pair.b.x);
const store = load('@/utils/scene-frame-store').createSceneFrameStore();
let notifications = 0;
const unsubscribe = store.subscribe(() => notifications++);
store.setFrame(frame => ({ ...frame, bounceElapsed: 42 }));
assert.equal(store.getSnapshot().bounceElapsed, 42);
assert.equal(notifications, 1);
unsubscribe();
store.setFrame(frame => ({ ...frame, bounceElapsed: 43 }));
assert.equal(notifications, 1);
console.log('Passed: 600 generated floors, stacked drops, guards from both sides, crowd layouts up to 500 actors, frame subscriptions.');
