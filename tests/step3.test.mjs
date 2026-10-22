import assert from 'node:assert/strict';
import test from 'node:test';

let game;
try {
  game = await import('../src/logic.mjs');
} catch {
  game = null;
}

function requirePickupRules() {
  assert.ok(game?.advancePickup && game?.addPickupToInventory, 'STEP 3 pickup rules must be available');
  return game;
}

test('a pickup three blocks away stays put and is not collected', () => {
  const { advancePickup } = requirePickupRules();
  const pickup = { x: 0, y: 1.18, z: 0 };
  const result = advancePickup(pickup, { x: 3, y: 1, z: 0 }, 1 / 60);
  assert.equal(result.collected, false);
  assert.deepEqual(result.position, pickup);
});

test('a pickup within one block moves toward the player and eventually collects', () => {
  const { advancePickup } = requirePickupRules();
  const player = { x: 0, y: 1, z: 0 };
  let pickup = { x: 0.9, y: 1.18, z: 0 };
  const first = advancePickup(pickup, player, 1 / 60);
  assert.equal(first.collected, false);
  assert.ok(first.position.x < pickup.x);
  pickup = first.position;
  let result = first;
  for (let frame = 0; frame < 30 && !result.collected; frame += 1) {
    result = advancePickup(pickup, player, 1 / 60);
    pickup = result.position;
  }
  assert.equal(result.collected, true);
});

test('collecting adds exactly one item to the matching or leftmost empty slot', () => {
  const { addPickupToInventory } = requirePickupRules();
  const inventory = [null, { type: 'stone', count: 2 }, null, null];
  assert.equal(addPickupToInventory(inventory, 'dirt'), 0);
  assert.deepEqual(inventory[0], { type: 'dirt', count: 1 });
  assert.equal(addPickupToInventory(inventory, 'stone'), 1);
  assert.deepEqual(inventory[1], { type: 'stone', count: 3 });
});
