import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const sw = readFileSync('sw.js', 'utf8');
const listed = [...sw.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]);

test('every cached file exists', () => {
  for (const f of listed.filter((p) => p !== './')) assert.ok(existsSync(f), `${f} missing`);
});

test('all app modules and shell files are cached', () => {
  const modules = readdirSync('.').filter((f) => f.endsWith('.js') && f !== 'sw.js');
  const required = [...modules, 'index.html', 'style.css', 'manifest.webmanifest'];
  for (const f of required) assert.ok(listed.includes(`./${f}`), `${f} not in cache list`);
  assert.ok(listed.includes('./icons/icon-192.png'));
});

test('cache is versioned and old caches are removed', () => {
  assert.match(sw, /kids-draw-v\d+/);
  assert.match(sw, /caches\.delete/);
});

test('app registers the service worker with a relative path', () => {
  assert.match(readFileSync('app.js', 'utf8'), /serviceWorker\.register\('\.\/sw\.js'\)/);
});
