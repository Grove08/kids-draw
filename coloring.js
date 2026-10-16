import { ANIMALS } from './animals.js';
import { createTemplate } from './template.js';

// Picker screen: a grid of animal outlines; tapping one starts a coloring page.
export function createColoring(container, { onPick, onExit }) {
  function thumb(animal) {
    const size = 160;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(size * ratio);
    c.style.width = c.style.height = '100%';
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    const t = createTemplate(animal, size, size, ratio);
    ctx.save();
    t.clip(ctx);
    ctx.fillStyle = '#f1ede3';
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
    t.drawOutline(ctx);
    return c;
  }

  function render() {
    container.replaceChildren();
    const header = document.createElement('div');
    header.className = 'alpha-header';
    const home = document.createElement('button');
    home.className = 'tool';
    home.type = 'button';
    home.textContent = '🏠';
    home.setAttribute('aria-label', 'home');
    home.addEventListener('click', onExit);
    header.append(home);

    const grid = document.createElement('div');
    grid.className = 'color-grid';
    for (const a of ANIMALS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'color-cell';
      b.setAttribute('aria-label', a.name);
      b.append(thumb(a));
      b.addEventListener('click', () => onPick(a));
      grid.append(b);
    }
    container.append(header, grid);
  }

  return { render };
}
