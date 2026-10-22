import assert from 'node:assert/strict';
import test from 'node:test';

let game;
try {
  game = await import('../src/logic.mjs');
} catch {
  game = null;
}

function requireRepeatRules() {
  assert.ok(game?.advancePlacementRepeat, 'STEP 5 placement-repeat rules must be available');
  return game;
}

test('held right-click repeats placement after the repeat interval', () => {
  const { advancePlacementRepeat } = requireRepeatRules();
  const firstWait = advancePlacementRepeat(0.3, 0.2, true, true);
  assert.equal(firstWait.shouldPlace, false);
  assert.ok(Math.abs(firstWait.timer - 0.1) < 1e-9);
  const firstRepeat = advancePlacementRepeat(firstWait.timer, 0.1, true, true);
  assert.equal(firstRepeat.shouldPlace, true);
  assert.equal(firstRepeat.timer, 0.3);
  const nextRepeat = advancePlacementRepeat(firstRepeat.timer, 0.3, true, true);
  assert.equal(nextRepeat.shouldPlace, true);
});

test('releasing right-click or ending play stops repeated placement', () => {
  const { advancePlacementRepeat } = requireRepeatRules();
  assert.equal(advancePlacementRepeat(0, 0.1, false, true).shouldPlace, false);
  assert.equal(advancePlacementRepeat(0, 0.1, true, false).shouldPlace, false);
});

test('each held placement consumes exactly one item and adds one block', () => {
  const { advancePlacementRepeat, placeInventoryBlock } = requireRepeatRules();
  const inventory = [{ type: 'planks', count: 4 }];
  const world = new Map();
  let timer = 0.3;
  let placements = 0;

  const placeNext = () => placeInventoryBlock(inventory, 0, { x: placements, y: 2, z: 3 }, () => true, (position, type) => {
    world.set(`${position.x},${position.y},${position.z}`, type);
  });

  assert.equal(placeNext(), true);
  placements += 1;
  for (let index = 0; index < 9; index += 1) {
    const update = advancePlacementRepeat(timer, 0.1, true, true);
    timer = update.timer;
    if (update.shouldPlace) {
      assert.equal(placeNext(), true);
      placements += 1;
    }
  }

  assert.equal(placements, 4);
  assert.equal(world.size, 4);
  assert.equal(inventory[0], null);
});
