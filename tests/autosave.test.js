import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutosave } from '../autosave.js';

function fakeTimers() {
  let now = 0, nextId = 1;
  const pending = new Map();
  return {
    setTimeout(fn, ms) { const id = nextId++; pending.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { pending.delete(id); },
    async advance(ms) {
      now += ms;
      for (const [id, t] of [...pending]) {
        if (t.at <= now) { pending.delete(id); await t.fn(); }
      }
    },
  };
}

test('three triggers within delay produce one save', async () => {
  const timers = fakeTimers(); let saves = 0;
  const a = createAutosave(async () => { saves++; }, 2000, timers);
  a.trigger(); await timers.advance(1000); a.trigger(); await timers.advance(1000); a.trigger();
  await timers.advance(1999); assert.equal(saves, 0);
  await timers.advance(1); assert.equal(saves, 1);
});

test('trigger after delay produces a second save', async () => {
  const timers = fakeTimers(); let saves = 0;
  const a = createAutosave(async () => { saves++; }, 2000, timers);
  a.trigger(); await timers.advance(2000);
  a.trigger(); await timers.advance(2000);
  assert.equal(saves, 2);
});

test('flush saves immediately and cancels the pending timer', async () => {
  const timers = fakeTimers(); let saves = 0;
  const a = createAutosave(async () => { saves++; }, 2000, timers);
  a.trigger(); await a.flush();
  assert.equal(saves, 1);
  await timers.advance(5000);
  assert.equal(saves, 1);
});

test('flush with nothing pending does not call save', async () => {
  const timers = fakeTimers(); let saves = 0;
  const a = createAutosave(async () => { saves++; }, 2000, timers);
  await a.flush();
  assert.equal(saves, 0);
});

test('save rejection does not break later triggers', async () => {
  const timers = fakeTimers(); let calls = 0;
  const a = createAutosave(async () => { calls++; if (calls === 1) throw new Error('boom'); }, 2000, timers);
  a.trigger(); await timers.advance(2000);
  a.trigger(); await timers.advance(2000);
  assert.equal(calls, 2);
});
