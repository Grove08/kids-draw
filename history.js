// Undo history. `states` holds snapshots; the last one is the current state.
export function createHistory(limit = 20) {
  let states = [];
  return {
    reset(base) { states = [base]; },
    push(snapshot) {
      states.push(snapshot);
      if (states.length > limit + 1) states.shift();
    },
    canUndo() { return states.length > 1; },
    undo() {
      if (states.length <= 1) return null;
      states.pop();
      return states[states.length - 1];
    },
  };
}
