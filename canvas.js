import { createHistory } from './history.js';
import { WIDTHS, shouldIgnorePointer, canvasPixelRatio, stampFontSize } from './drawing-logic.js';

const PIXEL_BUDGET = 4_000_000; // max backing-store pixels, keeps iPad memory sane
const BG = '#ffffff';

export function createBoard(canvasEl, { onChange = () => {} } = {}) {
  const ctx = canvasEl.getContext('2d');
  const history = createHistory(20);
  let cssW = 0, cssH = 0, ratio = 1;
  let color = '#212121', widthKey = 'medium', tool = 'brush', stamp = '🐱';
  let activeId = null, last = null, mid = null;
  let queue = Promise.resolve();

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

  // Draw `img` scaled uniformly to fit the board, centered (no distortion).
  function drawContain(img, w, h) {
    const s = Math.min(cssW / w, cssH / h);
    const dw = w * s, dh = h * s;
    ctx.drawImage(img, (cssW - dw) / 2, (cssH - dh) / 2, dw, dh);
  }

  // On resize the picture is scaled uniformly to fit (no distortion) and history restarts,
  // because earlier snapshots have the old pixel size.
  const ro = new ResizeObserver(() => {
    const oldCanvas = canvasEl.width ? snapshotCanvas() : null;
    const oldCss = { w: cssW, h: cssH };
    if (activeId !== null) return;
    measure();
    if (cssW === oldCss.w && cssH === oldCss.h) return;
    canvasEl.width = Math.round(cssW * ratio);
    canvasEl.height = Math.round(cssH * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    fillWhite();
    if (oldCanvas && oldCss.w) drawContain(oldCanvas, oldCss.w, oldCss.h);
    enqueue(async () => { history.reset(await toBlob()); onChange(); });
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
    enqueue(async () => { history.push(await toBlob()); onChange(); });
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
    ctx.beginPath();
    ctx.arc(p.x, p.y, WIDTHS[widthKey] / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTo(p) {
    strokeStyle();
    const m = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(mid.x, mid.y);
    ctx.quadraticCurveTo(last.x, last.y, m.x, m.y);
    ctx.stroke();
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
    if (tool === 'stamp') { placeStamp(p); return; }
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
    drawContain(bmp, bmp.width / ratio, bmp.height / ratio);
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
        if (blob) { await paintBlob(blob); onChange(); }
      });
    },
    clear() {
      fillWhite();
      return enqueue(async () => { history.reset(await toBlob()); onChange(); });
    },
    async loadImage(blob) {
      fillWhite();
      if (blob) await paintBlob(blob);
      return enqueue(async () => { history.reset(await toBlob()); });
    },
    toBlob,
  };
}
