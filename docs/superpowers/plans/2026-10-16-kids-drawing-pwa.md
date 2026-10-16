# Детская рисовалка (PWA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA-рисовалка для ребёнка 3 лет на iPhone: кисть, ластик, цвет, толщина, штампы-эмодзи, отмена, галерея с автосохранением, сохранение в «Фото» для родителей.

**Architecture:** Статические файлы без сборки, ES-модули. Чистая логика (история отмены, расчёты кисти, отсев касаний, дебаунс автосохранения) вынесена в модули без DOM и тестируется `node --test`. DOM-код (canvas, UI, IndexedDB, service worker) проверяется в браузере вручную по чек-листам.

**Tech Stack:** HTML/CSS/JS (ES modules), Canvas 2D, Pointer Events, IndexedDB, Service Worker, Web Share API; тесты — встроенный `node:test` (Node ≥ 18), без npm-зависимостей; локальный сервер — `npx serve` или `python -m http.server`.

**Spec:** `docs/superpowers/specs/2026-10-16-kids-drawing-pwa-design.md`

## Global Constraints

- Никакого текста в интерфейсе ребёнка: только картинки, цвета, эмодзи.
- Цвета: 8 кружков — красный, оранжевый, жёлтый, зелёный, голубой, синий, фиолетовый, чёрный.
- Толщина: ровно 3 значения (тонкая, средняя, толстая); ластик берёт выбранную толщину.
- Штампы: ~12 эмодзи-зверушек, не перетаскиваются и не масштабируются после установки.
- Отмена: последние 20 действий.
- Автосохранение: через 2 с после последнего изменения.
- Родительская зона: удержание шестерёнки 2 с; внутри «Сохранить в Фото» (Share) и «Удалить рисунок».
- Касания большой площадью (ладонь) игнорируются.
- Без сборки и без npm-зависимостей; данные только на устройстве; запрос `navigator.storage.persist()`.
- Safe-area (`env(safe-area-inset-*)`), запрет выделения и «резинового» скролла.
- Холст масштабируется по `devicePixelRatio` с верхним пределом 3.

## Review Focus

- Палец ушёл за край экрана или касание отменено системой (`pointercancel`) во время штриха: штрих завершается, холст не «залипает» в режиме рисования.
- Два пальца одновременно: рисует только первый указатель, второй не ломает историю отмены.
- Поворот экрана / изменение размера окна: уже нарисованное не стирается и не искажается.
- Отмена на пустой истории и повторная отмена после автосохранения: ничего не падает, кнопка просто не действует.
- IndexedDB недоступна (приватный режим, квота): приложение рисует дальше, ребёнок не видит ошибок, родитель видит предупреждение в родительской зоне.

---

### Task 1: Каркас PWA и тестовая инфраструктура

**Files:**
- Create: `index.html`, `style.css`, `manifest.webmanifest`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png`, `package.json` (только `"type": "module"` и скрипт `"test": "node --test"`), `.gitignore`
- Test: `tests/smoke.test.js`

**Interfaces:**
- Produces: `index.html` с контейнерами `#screen-canvas` и `#screen-gallery`, подключает `app.js` как `<script type="module">`; мета-теги iOS (`apple-mobile-web-app-capable`, `viewport-fit=cover`, `user-scalable=no`); манифест `display: standalone`, `orientation: any`.

- [ ] **Step 1: Failing test `tests/smoke.test.js`:** `test('manifest is valid for install')` читает `manifest.webmanifest` и проверяет `display === 'standalone'`, наличие иконок 192 и 512; `test('index has both screens')` проверяет, что `index.html` содержит `id="screen-canvas"` и `id="screen-gallery"`.
- [ ] **Step 2:** `git init`; запустить `npm test`; ожидается FAIL (файлов нет).
- [ ] **Step 3:** Создать перечисленные файлы. Иконки: простая цветная кисть/зверушка на градиенте, сгенерировать скриптом/эмодзи-рендером в PNG нужных размеров. CSS: `touch-action: none` на холсте, `user-select: none`, `overscroll-behavior: none`, `height: 100dvh`.
- [ ] **Step 4:** `npm test` — PASS. Запустить `python -m http.server 8080`, открыть в браузере: страница грузится без ошибок консоли.
- [ ] **Step 5:** Commit `chore: PWA shell`.

### Task 2: История отмены

**Files:**
- Create: `history.js`
- Test: `tests/history.test.js`

**Interfaces:**
- Produces: `createHistory(limit = 20) -> { push(snapshot), undo() -> snapshot|null, canUndo() -> boolean, reset(snapshot) }`. `snapshot` — произвольное значение (в приложении `ImageData`). `reset` задаёт начальное состояние (пустой холст или открытый рисунок), к которому можно вернуться отменой.

- [ ] **Step 1: Failing tests:** `undo on fresh history returns null and canUndo is false`; `push then undo returns previous snapshot`; `limit 20 drops oldest snapshots (push 25, undo 20 times, 21st undo returns null)`; `reset clears stack and sets base`; `undo never removes the base snapshot`.
- [ ] **Step 2:** `npm test` — FAIL.
- [ ] **Step 3:** Реализовать `createHistory` в `history.js` (массив снимков; база всегда остаётся; при превышении лимита отбрасывается самый старый не-базовый снимок).
- [ ] **Step 4:** `npm test` — PASS.
- [ ] **Step 5:** Commit `feat: undo history`.

### Task 3: Чистая логика рисования (кисть, толщина, отсев касаний)

**Files:**
- Create: `drawing-logic.js`
- Test: `tests/drawing-logic.test.js`

**Interfaces:**
- Produces:
  - `WIDTHS = { thin: 4, medium: 10, thick: 22 }` (в CSS-пикселях)
  - `COLORS: string[]` — 8 hex-значений в порядке из Global Constraints
  - `STAMPS: string[]` — 12 эмодзи (🐱🐶🐰🐻🦁🐘🐵🐸🐷🐮🦊🐼)
  - `shouldIgnorePointer(e: {pointerType, width, height, isPrimary}, activePointerId: number|null, pointerId: number) -> boolean` — true, если касание ладонью (`max(width,height) > 60` при `pointerType === 'touch'`) или это не первый активный указатель
  - `canvasPixelRatio(devicePixelRatio: number) -> number` — `min(dpr || 1, 3)`
  - `stampFontSize(widthKey: 'thin'|'medium'|'thick') -> number` — размер штампа: 64 / 96 / 140 px

- [ ] **Step 1: Failing tests:** `palm (touch width 80) is ignored`; `finger (touch width 20) is accepted`; `second pointer while another is active is ignored`; `pen/mouse never counts as palm`; `canvasPixelRatio caps at 3 and falls back to 1`; `COLORS has 8 unique hex values`; `STAMPS has 12 unique entries`; `WIDTHS has exactly thin/medium/thick`.
- [ ] **Step 2:** `npm test` — FAIL.
- [ ] **Step 3:** Реализовать в `drawing-logic.js`.
- [ ] **Step 4:** `npm test` — PASS.
- [ ] **Step 5:** Commit `feat: drawing logic`.

### Task 4: Холст (рисование, ластик, штампы, отмена)

**Files:**
- Create: `canvas.js`
- Modify: `index.html` (добавить `<canvas id="board">` внутрь `#screen-canvas`), `style.css`

**Interfaces:**
- Consumes: `createHistory` (Task 2); `shouldIgnorePointer`, `canvasPixelRatio`, `WIDTHS`, `stampFontSize` (Task 3).
- Produces: `createBoard(canvasEl, { onChange }) -> { setColor(hex), setWidth(key), setTool('brush'|'eraser'|'stamp'), setStamp(emoji), undo(), canUndo(), clear(), loadImage(blobOrNull) -> Promise<void>, toBlob() -> Promise<Blob> }`. `onChange` вызывается после каждого завершённого действия (штрих, штамп, отмена) — по нему позже включается автосохранение.

- [ ] **Step 1:** Реализовать `createBoard`: размер канваса = CSS-размер × `canvasPixelRatio`; Pointer Events (`pointerdown/move/up/cancel`) с `setPointerCapture`; кисть — `lineCap/lineJoin = 'round'`, плавная линия через квадратичные кривые между серединами точек; ластик — `globalCompositeOperation = 'destination-out'` с фоном белого холста через нижний слой (фон рисуется CSS-цветом белого, холст прозрачный); штамп — `fillText(emoji)` по центру касания размером `stampFontSize`. Снимок `ImageData` кладётся в историю при `pointerup`/`pointercancel`. При `resize` содержимое сохраняется (копия → перерисовка в новый размер без искажения).
- [ ] **Step 2: Ручная проверка** (браузер, эмуляция iPhone): рисует мышью/касанием; ластик стирает; штамп ставится в точке касания; отмена возвращает предыдущее; 21-я отмена не действует; при изменении размера окна рисунок остаётся; выход пальца за край завершает штрих.
- [ ] **Step 3:** Commit `feat: drawing canvas`.

### Task 5: Панель инструментов

**Files:**
- Create: `app.js`
- Modify: `index.html`, `style.css`

**Interfaces:**
- Consumes: `createBoard` (Task 4); `COLORS`, `STAMPS`, `WIDTHS` (Task 3).
- Produces: `app.js` строит панель из констант: ряд цветных кнопок, 3 точки толщины, кнопка ластика, кнопка зверушки (открывает ленту `STAMPS`), кнопка «назад» (↶), кнопка-домик (🏠). Выбранный цвет и толщина подсвечиваются обводкой; выбор цвета/кисти выходит из режима штампа и ластика. Минимальный размер цели касания — 64×64 px.

- [ ] **Step 1:** Реализовать панель и связать с `board`; кнопка отмены серая (`disabled`), пока `!board.canUndo()`.
- [ ] **Step 2: Ручная проверка:** все 8 цветов меняют цвет; 3 толщины видимо различаются; ластик стирает выбранной толщиной; лента зверушек открывается и закрывается; штамп ставится, пока не выбрана кисть; все цели не меньше 64 px (DevTools).
- [ ] **Step 3:** Commit `feat: toolbar`.

### Task 6: Хранилище и автосохранение

**Files:**
- Create: `autosave.js`, `storage.js`
- Test: `tests/autosave.test.js`

**Interfaces:**
- Produces:
  - `createAutosave(save: () => Promise<void>, delayMs = 2000, timers = { setTimeout, clearTimeout }) -> { trigger(), flush() -> Promise<void> }` — `trigger` откладывает `save` на `delayMs` после последнего вызова, `flush` сохраняет немедленно (если есть несохранённое).
  - `openStorage() -> Promise<{ ok: boolean, list() -> Promise<Drawing[]>, get(id), put(drawing), remove(id) }>`; `Drawing = { id: string, blob: Blob, thumb: Blob, updatedAt: number }`. При недоступной IndexedDB `ok === false`, методы не бросают (list → `[]`).
  - `requestPersistence() -> Promise<boolean>` (`navigator.storage.persist`, без бросков).

- [ ] **Step 1: Failing tests (`autosave`, фейковые таймеры):** `three triggers within delay produce one save`; `trigger after delay produces second save`; `flush saves immediately and cancels pending timer`; `flush with nothing pending does not call save`; `save rejection does not break later triggers`.
- [ ] **Step 2:** `npm test` — FAIL.
- [ ] **Step 3:** Реализовать `autosave.js`.
- [ ] **Step 4:** `npm test` — PASS.
- [ ] **Step 5:** Реализовать `storage.js` поверх IndexedDB (база `kids-draw`, хранилище `drawings`, ключ `id`, индекс по `updatedAt`); миниатюра — PNG, уменьшенный до 256 px по большей стороне. Подключить в `app.js`: `board.onChange → autosave.trigger()`; `flush()` при нажатии домика и при событии `visibilitychange` (скрытие страницы). Вызвать `requestPersistence()` при старте.
- [ ] **Step 6: Ручная проверка:** нарисовать, подождать 2 с, перезагрузить — рисунок на месте через галерею (Task 7); в DevTools запретить IndexedDB — рисование продолжается, ошибок для ребёнка нет.
- [ ] **Step 7:** Commit `feat: storage and autosave`.

### Task 7: Галерея и родительская зона

**Files:**
- Create: `gallery.js`, `long-press.js`
- Test: `tests/long-press.test.js`
- Modify: `app.js`, `index.html`, `style.css`

**Interfaces:**
- Consumes: `openStorage`, `createAutosave` (Task 6); `board.loadImage`, `board.clear`, `board.toBlob` (Task 4).
- Produces:
  - `attachLongPress(el, onLongPress, ms = 2000, timers = {...}) -> detach()` — срабатывает, только если палец удерживается `ms` без `pointerup`/`pointercancel`/ухода за пределы элемента.
  - `gallery.js`: `showGallery()` рисует сетку миниатюр; первая ячейка — «+» (новый рисунок), остальные открывают рисунок в холсте; родительская зона (шестерёнка + `attachLongPress`) показывает «Сохранить в Фото» (`navigator.share({ files: [File] })`, при отсутствии Share API — скачивание файла) и «Удалить рисунок» с подтверждением; предупреждение, если `storage.ok === false`.

- [ ] **Step 1: Failing tests (`long-press`, фейковые таймеры):** `fires after 2000 ms hold`; `release before 2000 ms does not fire`; `pointercancel does not fire`; `leaving the element does not fire`; `detach removes listeners`.
- [ ] **Step 2:** `npm test` — FAIL.
- [ ] **Step 3:** Реализовать `long-press.js`.
- [ ] **Step 4:** `npm test` — PASS.
- [ ] **Step 5:** Реализовать `gallery.js` и переключение экранов в `app.js`; при открытии приложения показывается холст нового рисунка; домик → `autosave.flush()` → галерея.
- [ ] **Step 6: Ручная проверка:** новый рисунок появляется в галерее с миниатюрой; открытие и дорисовка перезаписывают тот же рисунок (не создают копию); короткое нажатие на шестерёнку ничего не открывает; удержание 2 с открывает родительскую зону; «Удалить» убирает рисунок после подтверждения; Share-лист открывается (на iPhone — в Task 8).
- [ ] **Step 7:** Commit `feat: gallery and parent zone`.

### Task 8: Офлайн, публикация и проверка на iPhone

**Files:**
- Create: `sw.js`
- Modify: `app.js` (регистрация SW), `index.html`
- Create: `README.md` (кратко: как установить на экран «Домой»)

**Interfaces:**
- Produces: `sw.js` кэширует оболочку (`index.html`, `style.css`, все `.js`, манифест, иконки) стратегией cache-first; версия кэша `kids-draw-v1`, старые кэши удаляются при `activate`.

- [ ] **Step 1:** Реализовать `sw.js` и регистрацию (`navigator.serviceWorker.register('./sw.js')` с относительным путём — важно для GitHub Pages в подкаталоге). Все пути в HTML/манифесте/SW относительные.
- [ ] **Step 2: Проверка офлайна в браузере:** загрузить, в DevTools включить Offline, перезагрузить — приложение открывается и рисует.
- [ ] **Step 3:** Создать репозиторий на GitHub, включить Pages (ветка `main`, корень); запушить (по подтверждению пользователя — публикация во вне).
- [ ] **Step 4: Проверка на iPhone пользователем:** открыть ссылку в Safari → «Поделиться → На экран "Домой"»; запустить с иконки: полноэкранный режим без адресной строки; рисование пальцем плавное; ладонь не оставляет следов; зверушки ставятся; автосохранение и галерея работают; в режиме «Самолёт» всё работает; «Сохранить в Фото» через Share-лист; повторить установку на телефоне жены.
- [ ] **Step 5:** Commit `feat: offline and deploy docs`.
