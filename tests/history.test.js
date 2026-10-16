import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../history.js';

test('undo on fresh history returns null and canUndo is false', () => {
  const h = createHistory();
  assert.equal(h.undo(), null);
  assert.equal(h.canUndo(), false);
});

test('push then undo returns previous snapshot', () => {
  const h = createHistory();
  h.reset('base');
  h.push('a');
  h.push('b');
  assert.equal(h.canUndo(), true);
  assert.equal(h.undo(), 'a');
  assert.equal(h.undo(), 'base');
  assert.equal(h.undo(), null);
});

test('limit 20 drops oldest snapshots', () => {
  const h = createHistory(20);
  h.reset('base');
  for (let i = 1; i <= 25; i++) h.push(`s${i}`);
  let undos = 0;
  while (h.undo() !== null) undos++;
  assert.equal(undos, 20);
});

test('reset clears stack and sets base', () => {
  const h = createHistory();
  h.push('x');
  h.reset('new');
  assert.equal(h.canUndo(), false);
  h.push('y');
  assert.equal(h.undo(), 'new');
});

test('undo stops at the oldest kept snapshot and then returns null', () => {
  const h = createHistory(2);
  h.reset('base');
  h.push('a'); h.push('b'); h.push('c');
  assert.equal(h.undo(), 'b');
  assert.equal(h.undo(), 'a');
  assert.equal(h.undo(), null);
  assert.equal(h.canUndo(), false);
});
