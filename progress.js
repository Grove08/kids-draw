// Learned letters, kept in localStorage; falls back to memory if storage is unusable.
export function createProgress(storage = globalThis.localStorage, key = 'kd-learned') {
  let set = new Set();
  try {
    const parsed = JSON.parse(storage.getItem(key));
    if (Array.isArray(parsed)) set = new Set(parsed.filter((x) => typeof x === 'string'));
  } catch { /* missing, throwing or corrupted storage: start empty */ }

  return {
    markLearned(ch) {
      set.add(ch);
      try { storage.setItem(key, JSON.stringify([...set])); } catch { /* keep in memory */ }
    },
    isLearned: (ch) => set.has(ch),
    learned: () => [...set],
  };
}
