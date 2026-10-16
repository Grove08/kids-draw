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

test('bottom inset: the animal box fits the area above the toolbar', () => {
  const t = fitTransform(400, 700, 0, { left: 0, bottom: 200 });
  close(t.scale, 4); // area 400x500 -> smaller side 400
  close(t.ox, 0);
  close(t.oy, 50); // centered in the 500px area
});
test('left inset: the animal box fits the area right of the toolbar strip', () => {
  const t = fitTransform(800, 300, 0, { left: 200, bottom: 0 });
  close(t.scale, 3); // area 600x300 -> smaller side 300
  close(t.ox, 200 + (600 - 300) / 2);
  close(t.oy, 0);
});
test('insets bigger than the canvas do not throw and give scale 0', () => {
  assert.equal(fitTransform(100, 100, 0.08, { left: 0, bottom: 500 }).scale, 0);
});
test('default insets behave like no insets', () => {
  assert.deepEqual(fitTransform(500, 500), fitTransform(500, 500, 0.08, { left: 0, bottom: 0 }));
});
