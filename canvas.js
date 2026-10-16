import { createHistory } from './history.js';
import { WIDTHS, shouldIgnorePointer, canvasPixelRatio, stampFontSize } from './drawing-logic.js';
import { createTemplate, fitTransform } from './template.js';

const PIXEL_BUDGET = 4_000_000; // max backing-store pixels, keeps iPad memory sane
const BG = '#ffffff';

export function createBoard(canvasEl, { onChange = () => {}, onHistory = () => {}, getInsets = () => ({ left: 0, bottom: 0 }) } = {}) {
  const ctx = canvasEl.getContext('2d');
  const history = createHistory(20);
  let cssW = 0, cssH = 0, ratio = 1;
  let color = '#212121', widthKey = 'medium', tool = 'brush', stamp = '🐱';
  let activeId = null, last = null, mid = null;
  let queue = Promise.resolve();
  let animal = null, template = null; // coloring mode: paint is clipped to the animal, outline on top

  const toBlob = () => new Promise((res) => canvasEl.toBlob(res, 'image/png'));

  function measure() {
    const r = canvasEl.getBoundingClientRect();
    cssW = Math.max(1, Math.round(r.width));
    cssH = Math.max(1, Math.round(r.height));
    const budget = Math.sqrt(PIXEL_BUDGET / (cssW * cssH));
    ratio = Math.min(canvasPixelRatio(window.devicePixelRatio), budget);
  }

  function fillWhite() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  // Draw `img` (w x h CSS px) scaled uniformly. Plain mode: fit and center (no distortion). Coloring
  // mode: follow the outline (`oldT` is the template the image was drawn with), so the old outline
  // lands exactly on the new one.
  function drawPlaced(img, w, h, oldT) {
    if (animal && oldT && template && oldT.scale > 0 && template.scale > 0) {
      const k = template.scale / oldT.scale;
      ctx.drawImage(img, template.cx - k * oldT.cx, template.cy - k * oldT.cy, w * k, h * k);
      return;
    }
    const s = Math.min(cssW / w, cssH / h);
    const dw = w * s, dh = h * s;
    ctx.drawImage(img, (cssW - dw) / 2, (cssH - dh) / 2, dw, dh);
  }

  function rebuildTemplate() {
    template = animal ? createTemplate(animal, cssW, cssH, ratio, getInsets()) : null;
  }

  // Run `fn` (painting) inside the animal's clip, then redraw the outline over `box` (CSS px).
  function paintIn(box, fn) {
    if (!template) { fn(); return; }
    ctx.save();
    template.clip(ctx);
    fn();
    ctx.restore();
    template.drawOutline(ctx, box);
  }
  const boxAround = (pts, pad) => {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
    return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
  };

  // On resize the picture is scaled uniformly to fit (no distortion) and history restarts,
  // because earlier snapshots have the old pixel size.
  const ro = new ResizeObserver(() => {
    const oldCanvas = canvasEl.width ? snapshotCanvas() : null;
    const oldCss = { w: cssW, h: cssH };
    const oldT = template;
    if (activeId !== null) return;
    const rect = canvasEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return; // screen hidden: keep the picture
    measure();
    if (cssW === oldCss.w && cssH === oldCss.h) return;
    canvasEl.width = Math.round(cssW * ratio);
    canvasEl.height = Math.round(cssH * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    fillWhite();
    rebuildTemplate();
    if (oldCanvas && oldCss.w) drawPlaced(oldCanvas, oldCss.w, oldCss.h, oldT);
    if (template) template.drawOutline(ctx);
    enqueue(async () => { history.reset(await toBlob()); onHistory(); });
  });

  // copy of the current backing store (taken before it is resized)
  function snapshotCanvas() {
    const c = document.createElement('canvas');
    c.width = canvasEl.width; c.height = canvasEl.height;
    c.getContext('2d').drawImage(canvasEl, 0, 0);
    return c;
  }

  function enqueue(fn) {
    queue = queue.then(fn).catch(() => {});
    return queue;
  }

  function commit() {
    enqueue(async () => { history.push(await toBlob()); onHistory(); onChange(); });
  }

  function pos(e) {
    const r = canvasEl.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function strokeStyle() {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = WIDTHS[widthKey];
    ctx.strokeStyle = tool === 'eraser' ? BG : color;
    ctx.fillStyle = ctx.strokeStyle;
  }

  function dot(p) {
    strokeStyle();
    paintIn(boxAround([p], WIDTHS[widthKey]), () => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, WIDTHS[widthKey] / 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawTo(p) {
    strokeStyle();
    const m = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
    paintIn(boxAround([mid, last, m], WIDTHS[widthKey]), () => {
      ctx.beginPath();
      ctx.moveTo(mid.x, mid.y);
      ctx.quadraticCurveTo(last.x, last.y, m.x, m.y);
      ctx.stroke();
    });
    mid = m;
    last = p;
  }

  function placeStamp(p) {
    ctx.font = `${stampFontSize(widthKey)}px -apple-system, "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(stamp, p.x, p.y);
  }

  function endStroke() {
    if (activeId === null) return;
    activeId = null;
    last = mid = null;
    commit();
  }

  canvasEl.addEventListener('pointerdown', (e) => {
    if (shouldIgnorePointer(e, activeId, e.pointerId)) return;
    activeId = e.pointerId;
    try { canvasEl.setPointerCapture(e.pointerId); } catch {}
    const p = pos(e);
    if (tool === 'stamp') { if (!template) placeStamp(p); return; }
    dot(p);
    last = mid = p;
  });

  canvasEl.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeId || tool === 'stamp' || !last) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of events.length ? events : [e]) drawTo(pos(ev));
  });

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvasEl.addEventListener(type, (e) => { if (e.pointerId === activeId) endStroke(); });
  }
  canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

  async function paintBlob(blob) {
    const bmp = await createImageBitmap(blob);
    fillWhite();
    const w = bmp.width / ratio, h = bmp.height / ratio;
    // a saved picture was drawn with the same kind of template (same toolbar insets, other size)
    drawPlaced(bmp, w, h, animal ? createTemplate(animal, w, h, ratio, getInsets()) : null);
    bmp.close?.();
  }

  measure();
  canvasEl.width = Math.round(cssW * ratio);
  canvasEl.height = Math.round(cssH * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  fillWhite();
  enqueue(async () => { history.reset(await toBlob()); });
  ro.observe(canvasEl);

  return {
    setColor(hex) { color = hex; tool = 'brush'; },
    setWidth(key) { if (WIDTHS[key]) widthKey = key; },
    setTool(t) { tool = t; },
    setStamp(emoji) { stamp = emoji; tool = 'stamp'; },
    canUndo: () => history.canUndo(),
    undo() {
      return enqueue(async () => {
        const blob = history.undo();
        if (blob) { await paintBlob(blob); onHistory(); onChange(); }
      });
    },
    clear() {
      fillWhite();
      return enqueue(async () => { history.reset(await toBlob()); onHistory(); onChange(); });
    },
    async loadImage(blob) {
      fillWhite();
      if (blob) await paintBlob(blob);
      return enqueue(async () => { history.reset(await toBlob()); onHistory(); });
    },
    // Coloring mode: pass an animal (see animals.js) or null for a plain drawing.
    setTemplate(a) {
      animal = a;
      rebuildTemplate();
      fillWhite();
      if (template) template.drawOutline(ctx);
      return enqueue(async () => { history.reset(await toBlob()); onHistory(); });
    },
    getTemplateId: () => animal?.id ?? null,
    settled: () => queue, // resolves when pending history work (snapshots) is done
    toBlob,
  };
}
