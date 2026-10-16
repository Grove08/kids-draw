import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('manifest is valid for install', () => {
  const m = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(m.display, 'standalone');
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192'));
  assert.ok(sizes.includes('512x512'));
});

test('index has both screens', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /id="screen-canvas"/);
  assert.match(html, /id="screen-gallery"/);
});
