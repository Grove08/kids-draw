// Pure logic for "paint over the letter": mask of the letter + how much of it was painted.
export function maskFromImageData(data, width, height, cols) {
  const rows = Math.max(1, Math.round((height * cols) / width));
  const sx = width / cols;
  const sy = height / rows;
  const cells = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const px = Math.min(width - 1, Math.floor((cx + 0.5) * sx));
      const py = Math.min(height - 1, Math.floor((cy + 0.5) * sy));
      if (data[(py * width + px) * 4 + 3] >= 128) cells[cy * cols + cx] = 1;
    }
  }
  return { cols, rows, cells };
}

function distToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

export function createCoverage(mask, threshold = 0.7) {
  const { cols, rows, cells } = mask;
  let total = 0;
  for (const c of cells) if (c) total++;
  let covered = new Uint8Array(cells.length);
  let count = 0;

  return {
    addSegment(x0, y0, x1, y1, radius) {
      const minX = Math.max(0, Math.floor(Math.min(x0, x1) - radius));
      const maxX = Math.min(cols - 1, Math.ceil(Math.max(x0, x1) + radius));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1) - radius));
      const maxY = Math.min(rows - 1, Math.ceil(Math.max(y0, y1) + radius));
      for (let cy = minY; cy <= maxY; cy++) {
        for (let cx = minX; cx <= maxX; cx++) {
          const i = cy * cols + cx;
          if (!cells[i] || covered[i]) continue;
          if (distToSegment(cx + 0.5, cy + 0.5, x0, y0, x1, y1) <= radius) { covered[i] = 1; count++; }
        }
      }
    },
    fraction: () => (total === 0 ? 0 : count / total),
    isDone() { return total > 0 && count / total >= threshold; },
    reset() { covered = new Uint8Array(cells.length); count = 0; },
  };
}
