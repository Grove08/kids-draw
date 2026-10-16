import test from 'node:test';
import assert from 'node:assert/strict';
import { attachLongPress } from '../long-press.js';

function fakeTimers() {
  let now = 0, nextId = 1; const pending = new Map();
  return {
    setTimeout(fn, ms) { const id = nextId++; pending.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { pending.delete(id); },
    advance(ms) { now += ms; for (const [id, t] of [...pending]) if (t.at <= now) { pending.delete(id); t.fn(); } },
  };
}
function fakeEl() {
  const l = {};
  return {
    addEventListener(t, f) { (l[t] ??= new Set()).add(f); },
    removeEventListener(t, f) { l[t]?.delete(f); },
    fire(t) { for (const f of [...(l[t] ?? [])]) f({ type: t }); },
    count() { return Object.values(l).reduce((n, s) => n + s.size, 0); },
  };
}

test('fires after 2000 ms hold', () => {
  const t = fakeTimers(), el = fakeEl(); let n = 0;
  attachLongPress(el, () => n++, 2000, t);
  el.fire('pointerdown'); t.advance(1999); assert.equal(n, 0); t.advance(1); assert.equal(n, 1);
});
test('release before 2000 ms does not fire', () => {
  const t = fakeTimers(), el = fakeEl(); let n = 0;
  attachLongPress(el, () => n++, 2000, t);
  el.fire('pointerdown'); t.advance(1000); el.fire('pointerup'); t.advance(5000); assert.equal(n, 0);
});
test('pointercancel does not fire', () => {
  const t = fakeTimers(), el = fakeEl(); let n = 0;
  attachLongPress(el, () => n++, 2000, t);
  el.fire('pointerdown'); el.fire('pointercancel'); t.advance(5000); assert.equal(n, 0);
});
test('leaving the element does not fire', () => {
  const t = fakeTimers(), el = fakeEl(); let n = 0;
  attachLongPress(el, () => n++, 2000, t);
  el.fire('pointerdown'); el.fire('pointerleave'); t.advance(5000); assert.equal(n, 0);
});
test('detach removes listeners', () => {
  const t = fakeTimers(), el = fakeEl(); let n = 0;
  const detach = attachLongPress(el, () => n++, 2000, t);
  detach(); assert.equal(el.count(), 0);
  el.fire('pointerdown'); t.advance(5000); assert.equal(n, 0);
});
