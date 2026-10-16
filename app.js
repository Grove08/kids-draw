import { createBoard } from './canvas.js';
import { COLORS, STAMPS, WIDTHS } from './drawing-logic.js';
import { createAutosave } from './autosave.js';
import { openStorage, requestPersistence, makeThumb } from './storage.js';
import { createGallery } from './gallery.js';
import { createSpeech } from './speech.js';
import { createProgress } from './progress.js';
import { createAlphabet } from './alphabet.js';
import { getAnimal } from './animals.js';
import { createColoring } from './coloring.js';

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
  let undoBtn, undoMini;
  const storage = await openStorage();
  requestPersistence();
  let currentId = crypto.randomUUID();
  const autosave = createAutosave(async () => {
    const blob = await board.toBlob();
    await storage.put({
      id: currentId, blob, thumb: await makeThumb(blob), updatedAt: Date.now(),
      template: board.getTemplateId() ?? undefined, // coloring pages reopen with their outline
    });
  });
  const canvasScreen = $('screen-canvas');
  // The toolbar floats over the canvas; coloring pages are fitted into the part it does not cover.
  const stripMq = window.matchMedia('(orientation: landscape) and (max-height: 600px)');
  const getInsets = () => (stripMq.matches
    ? { left: toolbar.offsetWidth, bottom: 0 }
    : { left: 0, bottom: toolbar.offsetHeight });
  const syncToolbarSize = () => {
    canvasScreen.style.setProperty('--tb-h', `${toolbar.offsetHeight}px`);
    canvasScreen.style.setProperty('--tb-w', `${toolbar.offsetWidth}px`);
  };
  new ResizeObserver(syncToolbarSize).observe(toolbar);
  const board = createBoard($('board'), {
    onChange: () => autosave.trigger(),
    onHistory: () => { undoBtn.disabled = !board.canUndo(); undoMini.disabled = undoBtn.disabled; },
    getInsets,
  });
  const galleryScreen = $('screen-gallery');
  // rAF is paused in background pages, so race it against a timer
  const nextFrame = () => Promise.race([
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    new Promise((r) => setTimeout(r, 150)),
  ]);

  const coloringScreen = $('screen-coloring');
  async function showCanvas(drawing, newAnimal = null) {
    galleryScreen.hidden = true;
    coloringScreen.hidden = true;
    canvasScreen.hidden = false;
    await nextFrame(); // let layout settle so the canvas has its real size
    currentId = drawing ? drawing.id : crypto.randomUUID();
    const animal = newAnimal ?? (drawing?.template ? getAnimal(drawing.template) : null); // unknown id: plain drawing
    colorBtns[colorBtns.length - 1].click(); // back to the default black brush
    animalBtn.hidden = animal !== null; // stamps are not used in coloring pages
    await board.setTemplate(animal);
    if (drawing) await board.loadImage(drawing.blob);
  }
  const alphabetScreen = $('screen-alphabet');
  const speech = createSpeech();
  const alphabet = createAlphabet(alphabetScreen, { speech, progress: createProgress(), onExit: () => showGallery() });
  function showAlphabet() {
    galleryScreen.hidden = true;
    canvasScreen.hidden = true;
    alphabetScreen.hidden = false;
    alphabet.showStrip();
  }
  const coloring = createColoring(coloringScreen, { onPick: (a) => showCanvas(null, a), onExit: () => showGallery() });
  function showColoring() {
    galleryScreen.hidden = true;
    coloringScreen.hidden = false;
    coloring.render();
  }
  const gallery = createGallery(galleryScreen, {
    storage,
    onNew: () => showCanvas(null),
    onOpen: (d) => showCanvas(d),
    onAlphabet: showAlphabet,
    onColoring: showColoring,
    hasVoice: () => speech.hasRussianVoice(),
  });
  async function flushAll() {
    await board.settled(); // last stroke's snapshot must land before saving
    await autosave.flush();
  }
  async function showGallery() {
    await flushAll();
    gallery.exitParentMode();
    canvasScreen.hidden = true;
    alphabetScreen.hidden = true;
    coloringScreen.hidden = true;
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

  // collapse the toolbar to draw on a bigger area; undo and home stay reachable
  const COLLAPSE_KEY = 'kd-toolbar-collapsed';
  let collapsed = false;
  try { collapsed = localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { /* per-viewer convenience only */ }
  const toggleBtn = button('toggle', '⬇️', 'toolbar');
  undoMini = button('undo mini-only', '↩️', 'undo');
  undoMini.disabled = true;
  undoMini.addEventListener('click', () => board.undo());
  const homeMini = button('home mini-only', '🏠', 'home');
  homeMini.addEventListener('click', showGallery);
  function applyCollapsed() {
    canvasScreen.classList.toggle('collapsed', collapsed);
    toggleBtn.textContent = collapsed ? '⬆️' : '⬇️';
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* ignore */ }
  }
  toggleBtn.addEventListener('click', () => { collapsed = !collapsed; applyCollapsed(); });
  $('minibar').append(toggleBtn, undoMini, homeMini);
  applyCollapsed();
  return { board, homeBtn };
}

startApp();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
