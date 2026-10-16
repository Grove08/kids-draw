// A coloring template: maps an animal (0..100 box) onto the canvas, clips paint to its shape
// and draws its outline on top.
export function fitTransform(cssW, cssH, margin = 0.08) {
  const m = Math.min(cssW, cssH);
  const scale = Math.max(0, (m * (1 - 2 * margin)) / 100);
  return { scale, ox: (cssW - 100 * scale) / 2, oy: (cssH - 100 * scale) / 2 };
}

export function createTemplate(animal, cssW, cssH, ratio = 1) {
  const { scale, ox, oy } = fitTransform(cssW, cssH);
  const clipPath = new Path2D();
  for (const f of animal.fills) clipPath.addPath(new Path2D(f));
  let layer = null;

  // The outline is rendered once into an offscreen layer: lines of back parts are hidden where
  // front parts cover them (fills are listed back to front), then details and dots go on top.
  function buildLayer() {
    layer = document.createElement('canvas');
    layer.width = Math.max(1, Math.round(cssW * ratio));
    layer.height = Math.max(1, Math.round(cssH * ratio));
    const L = layer.getContext('2d');
    L.scale(ratio, ratio);
    L.translate(ox, oy);
    L.scale(scale, scale);
    L.lineWidth = scale > 0 ? (0.012 * Math.min(cssW, cssH)) / scale : 1;
    L.lineCap = L.lineJoin = 'round';
    L.strokeStyle = L.fillStyle = '#000';
    animal.fills.forEach((f, i) => {
      L.globalCompositeOperation = 'source-over';
      L.stroke(new Path2D(f));
      L.globalCompositeOperation = 'destination-out';
      for (let j = i + 1; j < animal.fills.length; j++) L.fill(new Path2D(animal.fills[j]));
    });
    L.globalCompositeOperation = 'source-over';
    for (const l of animal.lines) if (!animal.fills.includes(l)) L.stroke(new Path2D(l));
    for (const d of animal.dots) { L.beginPath(); L.arc(d.x, d.y, d.r, 0, Math.PI * 2); L.fill(); }
  }

  return {
    scale,
    // Caller does ctx.save() before and ctx.restore() after: the clip stays until restore.
    clip(ctx) {
      const m = ctx.getTransform();
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);
      ctx.clip(clipPath);
      ctx.setTransform(m);
    },
    drawOutline(ctx) {
      if (!layer) buildLayer();
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(layer, 0, 0, cssW, cssH);
      ctx.restore();
    },
  };
}
