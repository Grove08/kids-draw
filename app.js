import { createBoard } from './canvas.js';
import { COLORS, STAMPS, WIDTHS } from './drawing-logic.js';
import { createAutosave } from './autosave.js';
import { openStorage, requestPersistence, makeThumb } from './storage.js';
import { createGallery } from './gallery.js';

const $ = (id) => document.getElementById(id);

function button(cls, content, label) {
  const b = document.createElement('button');
  b.className = `tool ${cls}`;
  b.type = 'button';
  b.setAttribute('aria-label', label);
  if (content instanceof Node) b.append(content); else b.textContent = content;
  return b;
}

export async function startApp() {
  const toolbar = $('toolbar');
  const tray = $('tray');
  let undoBtn;
  const storage = await openStorage();
  requestPersistence();
  let currentId = crypto.randomUUID();
  const autosave = createAutosave(async () => {
    const blob = await board.toBlob();
    await storage.put({ id: currentId, blob, thumb: await makeThumb(blob), updatedAt: Date.now() });
  });
  const board = createBoard($('board'), {
    onChange: () => autosave.trigger(),
    onHistory: () => { undoBtn.disabled = !board.canUndo(); },
  });
  const canvasScreen = $('screen-canvas');
  const galleryScreen = $('screen-gallery');
  // rAF is paused in background pages, so race it against a timer
  const nextFrame = () => Promise.race([
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    new Promise((r) => setTimeout(r, 150)),
  ]);

  async function showCanvas(drawing) {
    galleryScreen.hidden = true;
    canvasScreen.hidden = false;
    await nextFrame(); // let layout settle so the canvas has its real size
    currentId = drawing ? drawing.id : crypto.randomUUID();
    await board.loadImage(drawing ? drawing.blob : null);
  }
  const gallery = createGallery(galleryScreen, { storage, onNew: () => showCanvas(null), onOpen: (d) => showCanvas(d) });
  async function flushAll() {
    await board.settled(); // last stroke's snapshot must land before saving
    await autosave.flush();
  }
  async function showGallery() {
    await flushAll();
    gallery.exitParentMode();
    canvasScreen.hidden = true;
    galleryScreen.hidden = false;
    await gallery.render();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushAll(); });

  const selectIn = (group, btn) => {
    group.forEach((b) => b.classList.toggle('selected', b === btn));
  };

  // colors
  const colorBtns = COLORS.map((hex) => {
    const b = button('color', '', hex);
    b.style.background = hex;
    b.addEventListener('click', () => {
      board.setColor(hex);
      selectIn(colorBtns, b);
      eraserBtn.classList.remove('selected');
      animalBtn.classList.remove('selected');
    });
    return b;
  });
  colorBtns[colorBtns.length - 1].classList.add('selected');

  // widths
  const sizes = { thin: 8, medium: 18, thick: 32 };
  const widthBtns = Object.keys(WIDTHS).map((key) => {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.width = dot.style.height = `${sizes[key]}px`;
    const b = button('width', dot, key);
    b.addEventListener('click', () => { board.setWidth(key); selectIn(widthBtns, b); });
    return b;
  });
  widthBtns[1].classList.add('selected');

  // eraser
  const eraserBtn = button('eraser', '🧽', 'eraser');
  eraserBtn.addEventListener('click', () => {
    const on = !eraserBtn.classList.contains('selected');
    eraserBtn.classList.toggle('selected', on);
    animalBtn.classList.remove('selected');
    if (on) { board.setTool('eraser'); colorBtns.forEach((b) => b.classList.remove('selected')); }
    else { board.setTool('brush'); }
  });

  // stamps
  const animalBtn = button('animal', STAMPS[0], 'animals');
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  for (const emoji of STAMPS) {
    const b = button('stamp', emoji, emoji);
    b.addEventListener('click', () => {
      board.setStamp(emoji);
      animalBtn.textContent = emoji;
      animalBtn.classList.add('selected');
      eraserBtn.classList.remove('selected');
      colorBtns.forEach((c) => c.classList.remove('selected'));
      tray.hidden = true;
    });
    sheet.append(b);
  }
  tray.append(sheet);
  animalBtn.addEventListener('click', () => { tray.hidden = false; });
  tray.addEventListener('click', (e) => { if (e.target === tray) tray.hidden = true; });

  // undo + home
  undoBtn = button('undo', '↩️', 'undo');
  undoBtn.disabled = true;
  undoBtn.addEventListener('click', () => board.undo());
  const homeBtn = button('home', '🏠', 'home');
  homeBtn.addEventListener('click', showGallery);

  toolbar.append(...colorBtns, ...widthBtns, eraserBtn, animalBtn, undoBtn, homeBtn);
  return { board, homeBtn };
}

startApp();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
