import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const gameSource = await readFile(new URL('../src/game.js', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('the game surface can receive focus and the start screen explains how to play', () => {
  assert.match(pageSource, /<canvas[^>]*id="viewport"[^>]*tabindex="0"/);
  assert.match(pageSource, /hold left.*break/i);
  assert.match(pageSource, /collect.*right.mouse.*place/i);
  assert.match(pageSource, /Escape.*pause/i);
});

test('pointer lock failure leaves WASD and unlocked mouse controls available with feedback', () => {
  assert.match(gameSource, /pointerlockerror/);
  assert.match(gameSource, /requestMouseLock/);
  assert.match(gameSource, /if\s*\(active\)\s*pauseGame\(\)/);
  assert.match(gameSource, /event\.code\s*===\s*['"]KeyW['"]|KeyW:/);
});

test('right click explains why placement does nothing before collecting a block', () => {
  assert.match(gameSource, /Collect a block before placing/);
});
