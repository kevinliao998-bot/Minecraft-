import assert from 'node:assert/strict';
import test from 'node:test';

let game;
try {
  game = await import('../src/logic.mjs');
} catch {
  game = null;
}

function requireMiningRules() {
  assert.ok(game?.advanceMining, 'STEP 1 mining rules must be available');
  return game;
}

test('holding on dirt shows growing cracks and breaks it in under one second', () => {
  const { advanceMining, miningComplete } = requireMiningRules();
  const first = advanceMining({ elapsed: 0 }, 'dirt', 0.4);
  assert.equal(first.stage, 0);
  assert.ok(first.opacity > 0.32, 'crack overlay should grow while held');
  assert.equal(miningComplete(first, 'dirt'), false);
  const later = advanceMining(first, 'dirt', 0.45);
  assert.equal(miningComplete(later, 'dirt'), true);
  assert.ok(later.elapsed < 1);
});

test('stone cracks advance one stage per second and take about two seconds', () => {
  const { advanceMining, miningComplete } = requireMiningRules();
  const beforeOneSecond = advanceMining({ elapsed: 0 }, 'stone', 0.99);
  assert.equal(beforeOneSecond.stage, 0);
  assert.equal(miningComplete(beforeOneSecond, 'stone'), false);
  const afterOneSecond = advanceMining(beforeOneSecond, 'stone', 0.02);
  assert.equal(afterOneSecond.stage, 1);
  assert.equal(miningComplete(afterOneSecond, 'stone'), false);
  const almostDone = advanceMining(afterOneSecond, 'stone', 0.98);
  assert.equal(miningComplete(almostDone, 'stone'), false);
  const done = advanceMining(almostDone, 'stone', 0.02);
  assert.equal(miningComplete(done, 'stone'), true);
  assert.ok(done.elapsed >= 2 && done.elapsed < 2.1);
});

test('a short click does not break a block and releasing resets mining progress', () => {
  const { advanceMining, miningComplete, resetMining } = requireMiningRules();
  const clicked = advanceMining({ elapsed: 0 }, 'dirt', 0.15);
  assert.equal(miningComplete(clicked, 'dirt'), false);
  const released = resetMining();
  assert.equal(released.elapsed, 0);
  const nextHold = advanceMining(released, 'dirt', 0.5);
  assert.equal(miningComplete(nextHold, 'dirt'), false);
});
