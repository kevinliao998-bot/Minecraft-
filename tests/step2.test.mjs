import assert from 'node:assert/strict';
import test from 'node:test';

let game;
try {
  game = await import('../src/logic.mjs');
} catch {
  game = null;
}

function requireDropRules() {
  assert.ok(game?.createDropState && game?.advanceDrop, 'STEP 2 drop rules must be available');
  return game;
}

test('a dropped block keeps its type, is small, and has a slow spin', () => {
  const { createDropState } = requireDropRules();
  const drop = createDropState({ x: 3, y: 2, z: 5 }, 'stone');
  assert.equal(drop.type, 'stone');
  assert.equal(drop.size, 0.34);
  assert.equal(drop.rotationSpeedY, 0.8);
  assert.deepEqual(drop.position, { x: 3.15, y: 3.45, z: 5.15 });
  assert.equal(drop.settled, false);
});

test('a falling drop lands on the ground and remains there', () => {
  const { createDropState, advanceDrop } = requireDropRules();
  let drop = createDropState({ x: 3, y: 2, z: 5 }, 'dirt');
  for (let frame = 0; frame < 240 && !drop.settled; frame += 1) {
    drop = advanceDrop(drop, 1, 1 / 60);
  }
  assert.equal(drop.settled, true);
  assert.equal(drop.position.y, 1.18);
  assert.equal(drop.velocityY, 0);
  const restingY = drop.position.y;
  drop = advanceDrop(drop, 1, 1);
  assert.equal(drop.position.y, restingY);
  assert.equal(drop.settled, true);
});

test('drop collision clamps to the ground even when a frame crosses it', () => {
  const { createDropState, advanceDrop } = requireDropRules();
  const drop = createDropState({ x: 3, y: 2, z: 5 }, 'sand');
  const landed = advanceDrop(drop, 2, 3);
  assert.equal(landed.position.y, 2.18);
  assert.equal(landed.settled, true);
  assert.equal(landed.velocityY, 0);
});
