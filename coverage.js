// Pure logic for "paint the letter": which share of the letter shape has been painted.
// Coordinates are in grid-cell units.

export function maskFromImageData(data, width, height, cols) {
  const rows = Math.round((height * cols) / width);
  const cells = new Uint8Array(cols * rows);
  const cw = width / cols, ch = height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = Math.min(width - 1, Math.floor((c + 0.5) * cw));
      const py = Math.min(height - 1, Math.floor((r + 0.5) * ch));
      if (data[(py * width + px) * 4 + 3] >= 128) cells[r * cols + c] = 1;
    }
  }
  return { cols, rows, cells };
}

function distToSegmentSq(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const ex = x0 + t * dx - px, ey = y0 + t * dy - py;
  return ex * ex + ey * ey;
}

export function createCoverage(mask, threshold = 0.7) {
  const { cols, rows, cells } = mask;
  let total = 0;
  for (let i = 0; i < cells.length; i++) total += cells[i];
  const covered = new Uint8Array(cells.length);
  let count = 0;

  return {
    addSegment(x0, y0, x1, y1, radius) {
      const minC = Math.max(0, Math.floor(Math.min(x0, x1) - radius - 1));
      const maxC = Math.min(cols - 1, Math.ceil(Math.max(x0, x1) + radius));
      const minR = Math.max(0, Math.floor(Math.min(y0, y1) - radius - 1));
      const maxR = Math.min(rows - 1, Math.ceil(Math.max(y0, y1) + radius));
      const r2 = radius * radius;
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const i = r * cols + c;
          if (!cells[i] || covered[i]) continue;
          if (distToSegmentSq(c + 0.5, r + 0.5, x0, y0, x1, y1) <= r2) { covered[i] = 1; count++; }
        }
      }
    },
    fraction() { return total === 0 ? 0 : count / total; },
    isDone() { return total > 0 && count / total >= threshold; },
    reset() { covered.fill(0); count = 0; },
  };
}
