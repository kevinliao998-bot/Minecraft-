import assert from 'node:assert/strict';
import test from 'node:test';

let game;
try {
  game = await import('../src/logic.mjs');
} catch {
  game = null;
}

function requireViewAndPerformanceRules() {
  assert.ok(
    game?.updateMouseLook && game?.renderPixelRatio && game?.shouldRenderFrame,
    'mouse-look and render-performance rules must be available',
  );
  return game;
}

test('mouse movement turns the view and clamps its vertical angle', () => {
  const { updateMouseLook } = requireViewAndPerformanceRules();
  assert.deepEqual(updateMouseLook({ yaw: 0, pitch: 0 }, 100, 50), {
    yaw: -0.22,
    pitch: -0.11,
  });
  assert.equal(updateMouseLook({ yaw: 0, pitch: 1.2 }, 0, -1000).pitch, 1.25);
  assert.equal(updateMouseLook({ yaw: 0, pitch: -1.2 }, 0, 1000).pitch, -1.25);
});

test('horizontal mouse turns can pass a complete revolution without clamping', () => {
  const { updateMouseLook } = requireViewAndPerformanceRules();
  let view = { yaw: 0, pitch: 0 };
  for (let turn = 0; turn < 10; turn++) view = updateMouseLook(view, 400, 0);
  assert.ok(Math.abs(view.yaw) > Math.PI * 2);
});

test('render resolution stays at or below the 1280 by 720 pixel budget', () => {
  const { renderPixelRatio } = requireViewAndPerformanceRules();
  assert.equal(renderPixelRatio(1280, 720, 1), 1);
  const ratio = renderPixelRatio(3840, 2160, 2);
  assert.ok(Math.abs(ratio - 1 / 3) < 1e-9);
  assert.ok(3840 * 2160 * ratio * ratio <= 1280 * 720 + 1);
});

test('renderer does not schedule more than 60 frames per second', () => {
  const { shouldRenderFrame } = requireViewAndPerformanceRules();
  assert.equal(shouldRenderFrame(116, 100), false);
  assert.equal(shouldRenderFrame(116.67, 100), true);
});
