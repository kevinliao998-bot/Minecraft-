import assert from 'node:assert/strict';
import test from 'node:test';

let game;
try {
  game = await import('../src/logic.mjs');
} catch {
  game = null;
}

function requirePlacementRules() {
  assert.ok(game?.placeInventoryBlock, 'STEP 4 placement rules must be available');
  return game;
}

test('right-click placement adds one block and consumes exactly one selected item', () => {
  const { placeInventoryBlock } = requirePlacementRules();
  const inventory = [{ type: 'dirt', count: 3 }, { type: 'stone', count: 2 }];
  const world = new Map();
  const placed = placeInventoryBlock(
    inventory,
    1,
    { x: 4, y: 3, z: 5 },
    () => true,
    (position, type) => world.set(`${position.x},${position.y},${position.z}`, type),
  );
  assert.equal(placed, true);
  assert.equal(world.get('4,3,5'), 'stone');
  assert.equal(inventory[0].count, 3);
  assert.equal(inventory[1].count, 1);
});

test('an empty or zero-count selected slot places nothing and keeps its count', () => {
  const { placeInventoryBlock } = requirePlacementRules();
  for (const inventory of [[null], [{ type: 'dirt', count: 0 }]]) {
    let placements = 0;
    assert.equal(placeInventoryBlock(inventory, 0, { x: 1, y: 1, z: 1 }, () => true, () => { placements += 1; }), false);
    assert.equal(placements, 0);
    if (inventory[0]) assert.equal(inventory[0].count, 0);
  }
});

test('blocked targets do not place a block or consume inventory', () => {
  const { placeInventoryBlock } = requirePlacementRules();
  const inventory = [{ type: 'brick', count: 1 }];
  let placements = 0;
  assert.equal(placeInventoryBlock(inventory, 0, { x: 2, y: 2, z: 2 }, () => false, () => { placements += 1; }), false);
  assert.equal(placements, 0);
  assert.equal(inventory[0].count, 1);
});

test('break, pickup, and placement return the inventory count to its starting value', () => {
  const { addPickupToInventory, placeInventoryBlock } = requirePlacementRules();
  const inventory = [null];
  const world = new Map();
  const startingCount = 0;
  assert.equal(addPickupToInventory(inventory, 'dirt'), 0);
  assert.equal(inventory[0].count, startingCount + 1);
  assert.equal(placeInventoryBlock(inventory, 0, { x: 3, y: 1, z: 3 }, () => true, (position, type) => {
    world.set(`${position.x},${position.y},${position.z}`, type);
  }), true);
  assert.equal(world.size, 1);
  assert.equal(inventory[0], null);
  assert.equal(inventory.reduce((sum, item) => sum + (item?.count ?? 0), 0), startingCount);
});
