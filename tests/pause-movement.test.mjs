import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const game = await import('../src/logic.mjs');
const gameSource = await readFile(new URL('../src/game.js', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('Escape toggles a dedicated pause overlay while the game is running', () => {
  assert.match(gameSource, /event\.code\s*===\s*['"]Escape['"]/);
  assert.match(gameSource, /pauseGame\(/);
  assert.match(pageSource, /id="pause/);
});

test('held movement advances one block per repeat interval and stops on release or pause', () => {
  assert.equal(typeof game.advanceMovementRepeat, 'function');
  assert.deepEqual(game.advanceMovementRepeat(0.2, 0.1, true, true), { shouldMove: false, timer: 0.1 });
  assert.deepEqual(game.advanceMovementRepeat(0.1, 0.11, true, true), { shouldMove: true, timer: 0.2 });
  assert.deepEqual(game.advanceMovementRepeat(0.1, 0.2, false, true), { shouldMove: false, timer: 0.1 });
  assert.deepEqual(game.advanceMovementRepeat(0.1, 0.2, true, false), { shouldMove: false, timer: 0.1 });
  assert.match(gameSource, /advanceMovementRepeat/);
});

test('visual horizontal position eases toward each one-block movement target', () => {
  assert.equal(typeof game.easeMovementPosition, 'function');
  assert.deepEqual(game.easeMovementPosition({ x: 0, z: 0 }, { x: 1, z: -1 }, 1), { x: 1, z: -1 });
  const halfway = game.easeMovementPosition({ x: 0, z: 0 }, { x: 1, z: -1 }, 0.5);
  assert.ok(halfway.x > 0 && halfway.x < 1);
  assert.ok(halfway.z < 0 && halfway.z > -1);
  assert.match(gameSource, /easeMovementPosition/);
});
