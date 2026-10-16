import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WIDTHS, COLORS, STAMPS, shouldIgnorePointer, canvasPixelRatio, stampFontSize,
} from '../drawing-logic.js';

const finger = { pointerType: 'touch', width: 20, height: 20, isPrimary: true };

test('palm (touch width 80) is ignored', () => {
  assert.equal(shouldIgnorePointer({ ...finger, width: 80 }, null, 1), true);
});
test('finger (touch width 20) is accepted', () => {
  assert.equal(shouldIgnorePointer(finger, null, 1), false);
});
test('second pointer while another is active is ignored', () => {
  assert.equal(shouldIgnorePointer(finger, 1, 2), true);
});
test('the same active pointer is still accepted', () => {
  assert.equal(shouldIgnorePointer(finger, 1, 1), false);
});
test('pen and mouse never count as palm', () => {
  assert.equal(shouldIgnorePointer({ pointerType: 'pen', width: 200, height: 200, isPrimary: true }, null, 1), false);
  assert.equal(shouldIgnorePointer({ pointerType: 'mouse', width: 200, height: 200, isPrimary: true }, null, 1), false);
});
test('canvasPixelRatio caps at 3 and falls back to 1', () => {
  assert.equal(canvasPixelRatio(5), 3);
  assert.equal(canvasPixelRatio(2), 2);
  assert.equal(canvasPixelRatio(undefined), 1);
  assert.equal(canvasPixelRatio(0), 1);
});
test('COLORS has 8 unique hex values', () => {
  assert.equal(COLORS.length, 8);
  assert.equal(new Set(COLORS).size, 8);
  for (const c of COLORS) assert.match(c, /^#[0-9a-f]{6}$/i);
});
test('STAMPS has 12 unique entries', () => {
  assert.equal(STAMPS.length, 12);
  assert.equal(new Set(STAMPS).size, 12);
});
test('WIDTHS has exactly thin/medium/thick, increasing', () => {
  assert.deepEqual(Object.keys(WIDTHS), ['thin', 'medium', 'thick']);
  assert.ok(WIDTHS.thin < WIDTHS.medium && WIDTHS.medium < WIDTHS.thick);
});
test('stampFontSize is 64/96/140 per width', () => {
  assert.equal(stampFontSize('thin'), 64);
  assert.equal(stampFontSize('medium'), 96);
  assert.equal(stampFontSize('thick'), 140);
});
