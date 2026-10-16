// IndexedDB storage for drawings. Never throws: if the DB is unavailable `ok` is false.
const DB_NAME = 'kids-draw';
const STORE = 'drawings';

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function requestPersistence() {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
}

export async function makeThumb(blob, maxSide = 256) {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * s));
  c.height = Math.max(1, Math.round(bmp.height * s));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return new Promise((res) => c.toBlob(res, 'image/png'));
}

export async function openStorage() {
  const none = { ok: false, list: async () => [], get: async () => null, put: async () => false, remove: async () => false };
  let db;
  try {
    db = await new Promise((res, rej) => {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => {
        const s = open.result.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('updatedAt', 'updatedAt');
      };
      open.onsuccess = () => res(open.result);
      open.onerror = () => rej(open.error);
      open.onblocked = () => rej(new Error('blocked'));
    });
  } catch { return none; }

  const store = (mode) => db.transaction(STORE, mode).objectStore(STORE);
  const safe = (fn, fallback) => async (...a) => { try { return await fn(...a); } catch { return fallback; } };

  return {
    ok: true,
    list: safe(async () => (await req(store('readonly').getAll())).sort((a, b) => b.updatedAt - a.updatedAt), []),
    get: safe((id) => req(store('readonly').get(id)).then((d) => d ?? null), null),
    put: safe(async (d) => { await req(store('readwrite').put(d)); return true; }, false),
    remove: safe(async (id) => { await req(store('readwrite').delete(id)); return true; }, false),
  };
}
