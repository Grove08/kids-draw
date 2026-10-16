import { LETTERS } from './letters.js';
import { attachLongPress } from './long-press.js';
import { createCoverage, maskFromImageData } from './coverage.js';
import { COLORS, STAMPS, WIDTHS, shouldIgnorePointer } from './drawing-logic.js';

const GRID = 128; // mask cells along the longer side
const FONT_FAMILY = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, sans-serif';
const GRAY = '#d9d9d9';
const PAINT_COLORS = COLORS.slice(0, 7); // everything but black

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  if (tag === 'button') n.type = 'button';
  return n;
}

export function createAlphabet(container, { speech, progress, onExit }) {
  let cleanup = () => {};

  function showStrip() {
    cleanup(); cleanup = () => {};
    container.replaceChildren();
    const header = el('div', 'alpha-header');
    const home = el('button', 'tool', '🏠');
    home.setAttribute('aria-label', 'home');
    home.addEventListener('click', onExit);
    header.append(home);

    // Parent zone: hold the gear for 2 s to reveal "reset stars" (hidden from the child).
    const gear = el('button', 'gear', '⚙️');
    gear.setAttribute('aria-label', 'parents');
    const resetBtn = el('button', 'mini del', '🗑 Сбросить звёздочки');
    resetBtn.hidden = true;
    resetBtn.addEventListener('click', () => {
      if (confirm('Сбросить все звёздочки?')) { progress.reset(); showStrip(); }
    });
    const detach = attachLongPress(gear, () => { resetBtn.hidden = !resetBtn.hidden; gear.classList.toggle('on', !resetBtn.hidden); }, 2000);
    header.append(resetBtn, gear);
    cleanup = detach;

    const grid = el('div', 'alpha-grid');
    LETTERS.forEach((l, i) => {
      const b = el('button', 'alpha-cell');
      b.append(el('span', 'ch', l.ch));
      if (progress.isLearned(l.ch)) b.append(el('span', 'star', '⭐'));
      b.setAttribute('aria-label', l.ch);
      b.addEventListener('click', () => showLetter(i)); // speaks inside this tap (iOS requires a gesture)
      grid.append(b);
    });
    container.append(header, grid);
  }

  function showLetter(index) {
    cleanup(); cleanup = () => {};
    container.replaceChildren();
    const letter = LETTERS[index];
    speech.speak(letter.say);

    const stage = el('div', 'alpha-stage');
    const canvas = el('canvas', 'alpha-canvas');
    stage.append(canvas);
    const info = el('button', 'alpha-info', letter.emoji ? `${letter.emoji} ${letter.word}` : '🔊');
    info.addEventListener('click', () => speech.speak(letter.say));
    const bar = el('div', 'alpha-bar');
    const back = el('button', 'tool', '🔠'); back.setAttribute('aria-label', 'letters');
    const redo = el('button', 'tool', '🧽'); redo.setAttribute('aria-label', 'again');
    const next = el('button', 'tool', '➡️'); next.setAttribute('aria-label', 'next');
    next.hidden = !progress.isLearned(letter.ch);
    bar.append(back, redo, next);
    const reward = el('div', 'reward');
    reward.hidden = true;
    container.append(stage, info, bar, reward);

    const ctx = canvas.getContext('2d');
    const color = PAINT_COLORS[index % PAINT_COLORS.length];
    let cssW = 0, cssH = 0, ratio = 1, fontPx = 0, coverage = null, cols = 1, rows = 1;
    let activeId = null, last = null, start = null, celebrated = false, rewardTimer = null;

    const fontFor = (px) => `bold ${px}px ${FONT_FAMILY}`;

    function paintLetter() {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.fillStyle = GRAY;
      ctx.font = fontFor(fontPx);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter.ch, cssW / 2, cssH / 2);
    }

    function buildMask() {
      const off = document.createElement('canvas');
      off.width = cssW; off.height = cssH;
      const o = off.getContext('2d');
      o.fillStyle = '#000';
      o.font = fontFor(fontPx);
      o.textAlign = 'center';
      o.textBaseline = 'middle';
      o.fillText(letter.ch, cssW / 2, cssH / 2);
      cols = cssW >= cssH ? GRID : Math.max(1, Math.round((GRID * cssW) / cssH));
      const mask = maskFromImageData(o.getImageData(0, 0, cssW, cssH).data, cssW, cssH, cols);
      rows = mask.rows;
      coverage = createCoverage(mask);
    }

    function setup() {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return; // screen hidden
      const w = Math.round(r.width), h = Math.round(r.height);
      if (w === cssW && h === cssH) return;
      cssW = w; cssH = h;
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * ratio);
      canvas.height = Math.round(cssH * ratio);
      ctx.font = fontFor(100);
      const w100 = ctx.measureText(letter.ch).width || 100;
      fontPx = Math.floor(Math.min(cssH * 0.85, (cssW * 0.88 * 100) / w100));
      paintLetter();
      buildMask();
    }

    const brushWidth = () => Math.max(WIDTHS.thick, Math.round(fontPx * 0.1));
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

    function paintSegment(a, b) {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.strokeStyle = ctx.fillStyle = color;
      ctx.lineWidth = brushWidth();
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const gx = cols / cssW, gy = rows / cssH;
      coverage.addSegment(a.x * gx, a.y * gy, b.x * gx, b.y * gy, (brushWidth() / 2) * gx);
      if (!celebrated && coverage.isDone()) celebrate();
    }

    function celebrate() {
      celebrated = true;
      speech.speak('Молодец!');
      progress.markLearned(letter.ch);
      reward.textContent = STAMPS[Math.floor(Math.random() * STAMPS.length)];
      reward.hidden = false;
      next.hidden = false;
      clearTimeout(rewardTimer);
      rewardTimer = setTimeout(() => { reward.hidden = true; }, 2500);
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (shouldIgnorePointer(e, activeId, e.pointerId) || !coverage) return;
      activeId = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      last = pos(e);
      start = { ...last, t: performance.now() };
      paintSegment(last, last);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activeId || !last) return;
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of events.length ? events : [e]) {
        const p = pos(ev);
        paintSegment(last, p);
        last = p;
      }
    });
    const end = (e) => {
      if (e.pointerId !== activeId) return;
      const tap = e.type === 'pointerup' && start && Math.hypot(last.x - start.x, last.y - start.y) < 12
        && performance.now() - start.t < 500;
      activeId = null; last = null;
      if (tap) speech.speak(letter.say); // pointerup counts as a user gesture on iOS
    };
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(t, end);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    back.addEventListener('click', showStrip);
    redo.addEventListener('click', () => { coverage.reset(); celebrated = false; paintLetter(); });
    next.addEventListener('click', () => (index + 1 < LETTERS.length ? showLetter(index + 1) : showStrip()));

    const ro = new ResizeObserver(() => { if (activeId === null) setup(); });
    ro.observe(canvas);
    setup();
    cleanup = () => { ro.disconnect(); clearTimeout(rewardTimer); };
  }

  return { showStrip, showLetter };
}
