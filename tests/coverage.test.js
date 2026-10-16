import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoverage, maskFromImageData } from '../coverage.js';

const row = (n) => ({ cols: n, rows: 1, cells: new Uint8Array(n).fill(1) });

test('empty mask gives fraction 0 and is never done', () => {
  const c = createCoverage({ cols: 4, rows: 4, cells: new Uint8Array(16) });
  c.addSegment(0, 0, 4, 4, 5);
  assert.equal(c.fraction(), 0);
  assert.equal(c.isDone(), false);
});
test('segment through the whole mask row covers it', () => {
  const c = createCoverage(row(10));
  c.addSegment(0, 0.5, 10, 0.5, 0.6);
  assert.equal(c.fraction(), 1);
  assert.equal(c.isDone(), true);
});
test('segment far outside the mask covers nothing', () => {
  const c = createCoverage(row(10));
  c.addSegment(0, 50, 10, 50, 1);
  assert.equal(c.fraction(), 0);
});
test('isDone flips exactly at 0.7', () => {
  const c = createCoverage(row(10));
  c.addSegment(0, 0.5, 6, 0.5, 0.3); // centers 0.5..5.5 -> 6 cells
  assert.equal(c.fraction(), 0.6);
  assert.equal(c.isDone(), false);
  c.addSegment(6, 0.5, 7, 0.5, 0.3); // cell 6 -> 7 cells
  assert.equal(c.fraction(), 0.7);
  assert.equal(c.isDone(), true);
});
test('wide brush covers cells a thin brush misses', () => {
  const mask = { cols: 5, rows: 5, cells: new Uint8Array(25).fill(1) };
  const thin = createCoverage(mask); thin.addSegment(0, 2.5, 5, 2.5, 0.6);
  const wide = createCoverage(mask); wide.addSegment(0, 2.5, 5, 2.5, 2);
  assert.ok(wide.fraction() > thin.fraction());
});
test('repeated segments do not count a cell twice', () => {
  const c = createCoverage(row(10));
  c.addSegment(0, 0.5, 5, 0.5, 0.3);
  const once = c.fraction();
  c.addSegment(0, 0.5, 5, 0.5, 0.3);
  assert.equal(c.fraction(), once);
});
test('reset clears coverage', () => {
  const c = createCoverage(row(10));
  c.addSegment(0, 0.5, 10, 0.5, 1);
  c.reset();
  assert.equal(c.fraction(), 0);
});
test('opaque pixels become 1, transparent become 0', () => {
  const w = 8, h = 8, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < 4; x++) data[(y * w + x) * 4 + 3] = 255;
  const m = maskFromImageData(data, w, h, 4);
  assert.deepEqual([m.cols, m.rows], [4, 4]);
  for (let y = 0; y < 4; y++) assert.deepEqual([...m.cells.slice(y * 4, y * 4 + 4)], [1, 1, 0, 0]);
});
test('rows follow the aspect ratio', () => {
  const m = maskFromImageData(new Uint8ClampedArray(16 * 8 * 4), 16, 8, 8);
  assert.deepEqual([m.cols, m.rows], [8, 4]);
});
