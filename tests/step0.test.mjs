import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

let game;
try {
  game = await import('../src/logic.mjs');
} catch {
  game = null;
}

function requireGame() {
  assert.ok(game, 'src/logic.mjs must provide the STEP 0 game rules');
  return game;
}

test('STEP 0 provides a full-screen static Three.js app shell', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<meta[^>]+name=["']viewport["']/i);
  assert.match(html, /three/i);
  assert.match(html, /<canvas|renderer/i);
});

test('STEP 0 world dimensions stay within 32 blocks on every axis', () => {
  const { WORLD_LIMIT, WORLD_DIMENSIONS } = requireGame();
  assert.equal(WORLD_LIMIT, 32);
  for (const axis of ['x', 'y', 'z']) {
    assert.ok(WORLD_DIMENSIONS[axis] > 0 && WORLD_DIMENSIONS[axis] <= WORLD_LIMIT);
  }
});

test('STEP 0 block types are limited to the supplied pack', () => {
  const { BLOCK_TYPES } = requireGame();
  assert.deepEqual(new Set(BLOCK_TYPES), new Set([
    'grass', 'dirt', 'stone', 'log', 'leaves', 'planks', 'sand', 'brick',
  ]));
});

test('one grounded WASD press moves exactly one block in its direction', () => {
  const { moveOneBlock } = requireGame();
  assert.deepEqual(moveOneBlock({ x: 4, y: 3, z: 4 }, 'forward', true), { x: 4, y: 3, z: 3 });
  assert.deepEqual(moveOneBlock({ x: 4, y: 3, z: 4 }, 'right', true), { x: 5, y: 3, z: 4 });
});

test('airborne directional movement is allowed and stays one block per press', () => {
  const { moveOneBlock } = requireGame();
  assert.deepEqual(moveOneBlock({ x: 4, y: 6, z: 4 }, 'left', false), { x: 3, y: 6, z: 4 });
});

test('jump allows a second press within one second and no third jump before landing', () => {
  const { pressJump, land } = requireGame();
  const first = pressJump({ grounded: true, jumps: 0, lastJumpAt: null }, 5000);
  assert.equal(first.accepted, true);
  const second = pressJump(first.state, 5999);
  assert.equal(second.accepted, true);
  const third = pressJump(second.state, 6000);
  assert.equal(third.accepted, false);
  const afterLanding = land(second.state);
  assert.equal(pressJump(afterLanding, 9000).accepted, true);
});

test('nearby-break chance is 5% once per break event and radius is five blocks', () => {
  const { shouldBreakNearby, withinRadius } = requireGame();
  assert.equal(shouldBreakNearby(() => 0.049), true);
  assert.equal(shouldBreakNearby(() => 0.05), false);
  assert.equal(withinRadius({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 4 }, 5), true);
  assert.equal(withinRadius({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 4 }, 5), false);
});

test('pickup range is about one block and items go to inventory slot zero', () => {
  const { pickupInRange, pickupSlot } = requireGame();
  assert.equal(pickupInRange(1), true);
  assert.equal(pickupInRange(3), false);
  assert.equal(pickupSlot(), 0);
});

test('structure spawning makes one 10% roll every 20 seconds', () => {
  const { structureSpawnAttempt } = requireGame();
  assert.deepEqual(structureSpawnAttempt(19999, 0, () => 0), { attempted: false, spawned: false });
  assert.deepEqual(structureSpawnAttempt(20000, 0, () => 0.099), { attempted: true, spawned: true });
  assert.deepEqual(structureSpawnAttempt(20000, 0, () => 0.1), { attempted: true, spawned: false });
});

test('structures use supplied block types and exclude the player position', () => {
  const { BLOCK_TYPES, structureBlockAllowed, structurePositionAllowed } = requireGame();
  for (const kind of BLOCK_TYPES) assert.equal(structureBlockAllowed(kind), true);
  assert.equal(structureBlockAllowed('unlisted'), false);
  assert.equal(structurePositionAllowed({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 }), false);
  assert.equal(structurePositionAllowed({ x: 2, y: 2, z: 3 }, { x: 1, y: 2, z: 3 }), true);
});

test('falling below the island triggers respawn at the newest valid spawn point', () => {
  const { fellBelowIsland, chooseRespawnPoint } = requireGame();
  assert.equal(fellBelowIsland(-1, 0), true);
  assert.equal(fellBelowIsland(0, 0), false);
  const original = { x: 2, y: 8, z: 2 };
  const previous = { x: 5, y: 4, z: 5 };
  assert.deepEqual(chooseRespawnPoint(original, previous, (p) => p === original), original);
  assert.deepEqual(chooseRespawnPoint(original, previous, (p) => p === previous), previous);
  assert.equal(chooseRespawnPoint(original, previous, () => false), null);
});
