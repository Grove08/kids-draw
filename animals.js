// Coloring outlines in a 0..100 x 0..100 box. `fills` are closed body parts (their union is the
// paintable area, listed back to front); `lines` are the outline strokes (every fill plus inner details);
// `dots` are eyes/noses.
const r = (n) => Math.round(n * 100) / 100;
const ellipse = (cx, cy, rx, ry) =>
  `M${r(cx - rx)} ${cy}A${rx} ${ry} 0 1 0 ${r(cx + rx)} ${cy}A${rx} ${ry} 0 1 0 ${r(cx - rx)} ${cy}Z`;
const circle = (cx, cy, rad) => ellipse(cx, cy, rad, rad);
// Ellipses are drawn counterclockwise on screen; polygons are normalized to the same winding so the
// union of all fills works with the nonzero fill rule when used as a clip.
const poly = (...pts) => {
  const area = pts.reduce((a, [x, y], i) => { const [nx, ny] = pts[(i + 1) % pts.length]; return a + (x * ny - nx * y); }, 0);
  const ordered = area > 0 ? [...pts].reverse() : pts;
  return `M${ordered.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
};

function animal(id, name, fills, details, dots) {
  return { id, name, fills, lines: [...fills, ...details], dots };
}
const eyes = (y, dx = 10, rad = 3.5) => [{ x: 50 - dx, y, r: rad }, { x: 50 + dx, y, r: rad }];
const mouth = (y) => `M50 ${y}L50 ${y + 4}M50 ${y + 4}Q45 ${y + 9} 41 ${y + 5}M50 ${y + 4}Q55 ${y + 9} 59 ${y + 5}`;

export const ANIMALS = [
  animal('cat', 'Кот',
    [poly([24, 42], [28, 12], [46, 30]), poly([76, 42], [72, 12], [54, 30]), circle(50, 56, 28)],
    [mouth(65), 'M30 62L10 57M30 67L10 69M70 62L90 57M70 67L90 69'],
    [...eyes(52), { x: 50, y: 62, r: 3 }]),
  animal('dog', 'Собака',
    [ellipse(22, 52, 10, 21), ellipse(78, 52, 10, 21), circle(50, 52, 26), ellipse(50, 66, 13, 10)],
    [mouth(68)],
    [...eyes(46, 11), { x: 50, y: 62, r: 4.5 }]),
  animal('rabbit', 'Заяц',
    [ellipse(38, 26, 8, 22), ellipse(62, 26, 8, 22), circle(50, 66, 24)],
    [mouth(72), 'M38 14Q35 26 38 38M62 14Q65 26 62 38'],
    [...eyes(62, 8), { x: 50, y: 69, r: 3 }]),
  animal('bear', 'Медведь',
    [circle(26, 30, 10), circle(74, 30, 10), circle(50, 56, 28), ellipse(50, 66, 12, 9)],
    [mouth(67)],
    [...eyes(50), { x: 50, y: 62, r: 4 }]),
  animal('elephant', 'Слон',
    [circle(24, 46, 17), circle(76, 46, 17), circle(50, 48, 22), ellipse(50, 78, 7, 18)],
    ['M43 74L57 74M43 81L57 81M43 88L57 88'],
    eyes(44, 9, 3)),
  animal('lion', 'Лев',
    [circle(24, 20, 8), circle(76, 20, 8), circle(50, 52, 40), circle(50, 54, 24)],
    [poly([45, 60], [55, 60], [50, 66]), mouth(66)],
    eyes(49)),
  animal('fish', 'Рыба',
    [poly([72, 50], [94, 30], [94, 70]), poly([34, 34], [48, 14], [58, 32]), ellipse(45, 50, 32, 20)],
    ['M54 36Q60 50 54 64', 'M13 52L18 54'],
    [{ x: 28, y: 45, r: 3.5 }]),
  animal('duck', 'Утка',
    [ellipse(50, 74, 30, 20), circle(50, 38, 18), poly([40, 42], [60, 42], [50, 53])],
    ['M36 72Q50 88 66 70'],
    eyes(34, 8, 3)),
];

export function getAnimal(id) {
  return ANIMALS.find((a) => a.id === id) ?? null;
}
