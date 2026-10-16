import { attachLongPress } from './long-press.js';

// Gallery screen. Parent mode (gear held 2 s) adds share/delete buttons to each drawing.
export function createGallery(container, { storage, onNew, onOpen, onAlphabet = () => {}, onColoring = () => {}, hasVoice = () => true }) {
  let parentMode = false;
  let urls = [];

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  async function shareDrawing(d) {
    const file = new File([d.blob], 'risunok.png', { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
    } catch (e) { if (e?.name === 'AbortError') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(d.blob);
    a.download = 'risunok.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function render() {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
    container.replaceChildren();

    const header = el('div', 'gallery-header');
    const gear = el('button', 'gear' + (parentMode ? ' on' : ''), '⚙️');
    gear.type = 'button';
    gear.setAttribute('aria-label', 'parents');
    attachLongPress(gear, () => { parentMode = !parentMode; render(); }, 2000);
    const abc = el('button', 'abc', '🔤');
    abc.type = 'button';
    abc.setAttribute('aria-label', 'alphabet');
    abc.addEventListener('click', onAlphabet);
    const paint = el('button', 'abc', '🖍️');
    paint.type = 'button';
    paint.setAttribute('aria-label', 'coloring');
    paint.addEventListener('click', onColoring);
    const tools = el('div', 'gallery-tools');
    tools.append(abc, paint);
    header.append(tools, gear);
    container.append(header);

    if (parentMode && !storage.ok) {
      container.append(el('p', 'warn', 'Не удаётся сохранять рисунки на этом устройстве (хранилище недоступно).'));
    }

    if (parentMode && !hasVoice()) {
      container.append(el('p', 'warn', 'Нет русского голоса: азбука будет без звука. Добавьте русский голос в Настройки → Универсальный доступ → Устная речь → Голоса.'));
    }

    const grid = el('div', 'grid');
    const add = el('button', 'cell new', '➕');
    add.type = 'button';
    add.setAttribute('aria-label', 'new drawing');
    add.addEventListener('click', onNew);
    grid.append(add);

    for (const d of await storage.list()) {
      const cell = el('div', 'cell');
      const open = el('button', 'thumb');
      open.type = 'button';
      const img = el('img');
      const url = URL.createObjectURL(d.thumb || d.blob);
      urls.push(url);
      img.src = url;
      img.alt = '';
      open.append(img);
      open.addEventListener('click', () => onOpen(d));
      cell.append(open);
      if (parentMode) {
        const share = el('button', 'mini share', '📤 В Фото');
        share.type = 'button';
        share.addEventListener('click', () => shareDrawing(d));
        const del = el('button', 'mini del', '🗑 Удалить');
        del.type = 'button';
        del.addEventListener('click', async () => {
          if (confirm('Удалить этот рисунок?')) { await storage.remove(d.id); render(); }
        });
        cell.append(share, del);
      }
      grid.append(cell);
    }
    container.append(grid);
  }

  return { render, exitParentMode() { parentMode = false; } };
}
