import test from 'node:test';
import assert from 'node:assert/strict';
import { ANIMALS, getAnimal } from '../animals.js';

const ORDER = ['cat', 'dog', 'rabbit', 'bear', 'elephant', 'lion', 'fish', 'duck'];
const nums = (s) => (s.match(/-?\d+(\.\d+)?/g) || []).map(Number);

test('has the 8 animals in the agreed order', () => {
  assert.deepEqual(ANIMALS.map((a) => a.id), ORDER);
});
test('ids are unique lowercase latin', () => {
  assert.equal(new Set(ANIMALS.map((a) => a.id)).size, ANIMALS.length);
  for (const a of ANIMALS) assert.match(a.id, /^[a-z]+$/);
});
test('every animal has a Russian name, at least one fill and one line', () => {
  for (const a of ANIMALS) {
    assert.match(a.name, /^[А-Яа-яЁё ]+$/, a.id);
    assert.ok(a.fills.length >= 1 && a.lines.length >= 1, a.id);
  }
});
test('every fill is a closed path', () => {
  for (const a of ANIMALS) for (const f of a.fills) {
    assert.ok(/^M/.test(f) && /Z/i.test(f), `${a.id}: ${f}`);
  }
});
test('all numbers in paths and dots lie within 0..100', () => {
  for (const a of ANIMALS) {
    for (const p of [...a.fills, ...a.lines]) for (const n of nums(p)) assert.ok(n >= 0 && n <= 100, `${a.id}: ${n} in ${p}`);
    for (const d of a.dots) for (const n of [d.x, d.y, d.r]) assert.ok(n >= 0 && n <= 100, `${a.id} dot ${n}`);
  }
});
test('every animal has at least one dot (eye)', () => {
  for (const a of ANIMALS) assert.ok(a.dots.length >= 1, a.id);
});
test('getAnimal returns the record by id and null for unknown id', () => {
  assert.equal(getAnimal('cat').id, 'cat');
  assert.equal(getAnimal('dragon'), null);
});
