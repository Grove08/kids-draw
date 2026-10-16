import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgress } from '../progress.js';

const fakeStorage = (init = {}) => {
  const d = { ...init };
  return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, d };
};

test('fresh progress has nothing learned', () => {
  const p = createProgress(fakeStorage());
  assert.deepEqual(p.learned(), []);
  assert.equal(p.isLearned('А'), false);
});
test('markLearned persists across a new createProgress on the same storage', () => {
  const s = fakeStorage();
  createProgress(s).markLearned('Б');
  assert.equal(createProgress(s).isLearned('Б'), true);
});
test('markLearned twice stores the letter once', () => {
  const p = createProgress(fakeStorage());
  p.markLearned('В'); p.markLearned('В');
  assert.deepEqual(p.learned(), ['В']);
});
test('corrupted JSON is treated as empty', () => {
  const p = createProgress(fakeStorage({ 'kd-learned': '{oops' }));
  assert.deepEqual(p.learned(), []);
  p.markLearned('Г');
  assert.equal(p.isLearned('Г'), true);
});
test('non-array JSON is treated as empty', () => {
  assert.deepEqual(createProgress(fakeStorage({ 'kd-learned': '{"a":1}' })).learned(), []);
});
test('storage that throws on setItem still remembers in memory', () => {
  const s = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  const p = createProgress(s);
  p.markLearned('Д');
  assert.equal(p.isLearned('Д'), true);
});
test('storage that throws on getItem works in memory', () => {
  const s = { getItem: () => { throw new Error('denied'); }, setItem: () => {} };
  const p = createProgress(s);
  assert.deepEqual(p.learned(), []);
  p.markLearned('Е');
  assert.equal(p.isLearned('Е'), true);
});
test('missing storage (undefined) works in memory', () => {
  const p = createProgress(undefined);
  p.markLearned('Ж');
  assert.deepEqual(p.learned(), ['Ж']);
});
