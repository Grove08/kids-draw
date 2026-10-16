// Fires onLongPress when the pointer is held on `el` for `ms` without release/leave/cancel.
const realTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
};

export function attachLongPress(el, onLongPress, ms = 2000, timers = realTimers) {
  let timer = null;
  const cancel = () => { if (timer !== null) { timers.clearTimeout(timer); timer = null; } };
  const start = () => { cancel(); timer = timers.setTimeout(() => { timer = null; onLongPress(); }, ms); };
  const cancelTypes = ['pointerup', 'pointercancel', 'pointerleave'];
  el.addEventListener('pointerdown', start);
  cancelTypes.forEach((t) => el.addEventListener(t, cancel));
  return () => {
    cancel();
    el.removeEventListener('pointerdown', start);
    cancelTypes.forEach((t) => el.removeEventListener(t, cancel));
  };
}
