// Pure drawing helpers (no DOM) so they can be unit-tested with node:test.
export const WIDTHS = { thin: 4, medium: 10, thick: 22 };

export const COLORS = [
  '#e53935', // red
  '#fb8c00', // orange
  '#fdd835', // yellow
  '#43a047', // green
  '#29b6f6', // light blue
  '#1e5bd8', // blue
  '#8e24aa', // purple
  '#212121', // black
];

export const STAMPS = ['🐱', '🐶', '🐰', '🐻', '🦁', '🐘', '🐵', '🐸', '🐷', '🐮', '🦊', '🐼'];

const PALM_SIZE = 60;
const STAMP_SIZES = { thin: 64, medium: 96, thick: 140 };

export function shouldIgnorePointer(e, activePointerId, pointerId) {
  if (activePointerId !== null && activePointerId !== pointerId) return true;
  if (e.pointerType === 'touch' && Math.max(e.width, e.height) > PALM_SIZE) return true;
  return false;
}

export function canvasPixelRatio(devicePixelRatio) {
  return Math.min(devicePixelRatio || 1, 3);
}

export function stampFontSize(widthKey) {
  return STAMP_SIZES[widthKey];
}
