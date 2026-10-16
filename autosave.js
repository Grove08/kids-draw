// Debounced autosave: save runs `delayMs` after the last trigger(); flush() saves now.
const realTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
};

export function createAutosave(save, delayMs = 2000, timers = realTimers) {
  let timer = null;
  let dirty = false;

  async function run() {
    timer = null;
    if (!dirty) return;
    dirty = false;
    try { await save(); } catch { /* storage problems must never reach the child */ }
  }

  return {
    trigger() {
      dirty = true;
      if (timer !== null) timers.clearTimeout(timer);
      timer = timers.setTimeout(run, delayMs);
    },
    async flush() {
      if (timer !== null) { timers.clearTimeout(timer); timer = null; }
      await run();
    },
  };
}
