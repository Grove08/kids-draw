import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoverage, maskFromImageData } from '../coverage.js';

const mask = (cols, rows, cells) => ({ cols, rows, cells: Uint8Array.from(cells) });
const full = (cols, rows) => mask(cols, rows, new Array(cols * rows).fill(1));

test('empty mask gives fraction 0 and is never done', () => {
  const c = createCoverage(mask(4, 4, new Array(16).fill(0)));
  c.addSegment(0, 0, 4, 4, 5);
  assert.equal(c.fraction(), 0);
  assert.equal(c.isDone(), false);
});

test('segment through the whole mask row covers it', () => {
  const c = createCoverage(full(10, 1));
  c.addSegment(0, 0.5, 10, 0.5, 0.6);
  assert.equal(c.fraction(), 1);
  assert.equal(c.isDone(), true);
});

test('segment far outside the mask covers nothing', () => {
  const c = createCoverage(full(10, 10));
  c.addSegment(50, 50, 60, 60, 2);
  assert.equal(c.fraction(), 0);
});

test('isDone flips exactly at 0.7 (10 cells: 6 covered false, 7 covered true)', () => {
  const c6 = createCoverage(full(10, 1));
  c6.addSegment(0.5, 0.5, 5.5, 0.5, 0.4); // cells 0..5 -> 6
  assert.equal(c6.fraction(), 0.6);
  assert.equal(c6.isDone(), false);
  const c7 = createCoverage(full(10, 1));
  c7.addSegment(0.5, 0.5, 6.5, 0.5, 0.4); // cells 0..6 -> 7
  assert.equal(c7.fraction(), 0.7);
  assert.equal(c7.isDone(), true);
});

test('wide brush covers cells a thin brush misses', () => {
  const thin = createCoverage(full(9, 9));
  thin.addSegment(0, 4.5, 9, 4.5, 0.5);
  const wide = createCoverage(full(9, 9));
  wide.addSegment(0, 4.5, 9, 4.5, 2.5);
  assert.ok(wide.fraction() > thin.fraction());
});

test('repeated segments do not count a cell twice', () => {
  const c = createCoverage(full(10, 1));
  c.addSegment(0.5, 0.5, 4.5, 0.5, 0.4);
  const once = c.fraction();
  c.addSegment(0.5, 0.5, 4.5, 0.5, 0.4);
  assert.equal(c.fraction(), once);
});

test('reset clears coverage', () => {
  const c = createCoverage(full(10, 1));
  c.addSegment(0, 0.5, 10, 0.5, 0.6);
  c.reset();
  assert.equal(c.fraction(), 0);
  assert.equal(c.isDone(), false);
});

test('only mask cells count: strokes outside the letter shape add nothing', () => {
  const cells = new Array(100).fill(0);
  for (let x = 0; x < 10; x++) cells[x] = 1; // only the top row is "letter"
  const c = createCoverage(mask(10, 10, cells));
  c.addSegment(0, 9.5, 10, 9.5, 0.6); // bottom row, off the letter
  assert.equal(c.fraction(), 0);
});

test('maskFromImageData: opaque pixels become 1, transparent become 0', () => {
  const w = 8, h = 8, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < 4; x++) data[(y * w + x) * 4 + 3] = 255;
  const m = maskFromImageData(data, w, h, 4);
  assert.equal(m.cols, 4);
  assert.equal(m.rows, 4);
  assert.deepEqual([...m.cells.slice(0, 4)], [1, 1, 0, 0]);
});

test('maskFromImageData: rows follow the aspect ratio', () => {
  const m = maskFromImageData(new Uint8ClampedArray(8 * 16 * 4), 8, 16, 4);
  assert.equal(m.rows, 8);
});
