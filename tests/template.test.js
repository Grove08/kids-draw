import test from 'node:test';
import assert from 'node:assert/strict';
import { fitTransform } from '../template.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !== ${b}`);

test('square canvas: scale = size*(1-2*margin)/100 and offsets equal margin*size', () => {
  const t = fitTransform(500, 500);
  close(t.scale, (500 * (1 - 0.16)) / 100);
  close(t.ox, 40);
  close(t.oy, 40);
});
test('wide canvas 200x100 centers horizontally', () => {
  const t = fitTransform(200, 100);
  close(t.scale, (100 * 0.84) / 100);
  close(t.oy, 8);
  close(t.ox, (200 - 100 * t.scale) / 2);
});
test('tall canvas keeps proportions (scale from the smaller side)', () => {
  const t = fitTransform(100, 300);
  close(t.scale, 0.84);
  close(t.ox, 8);
  close(t.oy, (300 - 100 * t.scale) / 2);
});
test('margin 0 fills the smaller side exactly', () => {
  const t = fitTransform(400, 300, 0);
  close(t.scale, 3);
  close(t.oy, 0);
});
test('zero-size canvas does not throw and gives scale 0', () => {
  const t = fitTransform(0, 0);
  assert.equal(t.scale, 0);
});
