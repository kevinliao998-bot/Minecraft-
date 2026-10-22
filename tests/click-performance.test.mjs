import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const game = await import('../src/logic.mjs');
const gameSource = await readFile(new URL('../src/game.js', import.meta.url), 'utf8');

test('instance capacity grows geometrically so ordinary edits can reuse GPU meshes', () => {
  assert.equal(typeof game.nextInstanceCapacity, 'function');
  assert.equal(game.nextInstanceCapacity(0, 1), 1);
  assert.equal(game.nextInstanceCapacity(8, 8), 8);
  assert.equal(game.nextInstanceCapacity(8, 9), 16);
  assert.equal(game.nextInstanceCapacity(16, 40), 64);
  assert.match(gameSource, /nextInstanceCapacity/);
});

test('dropped blocks share type resources instead of allocating geometry and material per click', () => {
  assert.match(gameSource, /pickupGeometry\s*=\s*new THREEJS\.BoxGeometry/);
  assert.match(gameSource, /pickupGroups/);
  assert.doesNotMatch(gameSource, /new THREEJS\.BoxGeometry\(drop\.size/);
  assert.doesNotMatch(gameSource, /item\.mesh\.geometry\.dispose\(\)/);
});

test('losing pointer lock does not pause gameplay during a mouse click', () => {
  const start = gameSource.indexOf("document.addEventListener('pointerlockchange'");
  const end = gameSource.indexOf("document.addEventListener('mousemove'", start);
  assert.ok(start >= 0 && end > start, 'pointer-lock change handler must exist');
  assert.doesNotMatch(gameSource.slice(start, end), /pauseGame\(/);
});
