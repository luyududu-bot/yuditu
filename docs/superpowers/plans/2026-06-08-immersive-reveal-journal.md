# Immersive Reveal and Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reliable, particle-enhanced soft-edge sand reveal and replace the broken journal page with a mobile-first bound-paper journal using the supplied sticker artwork.

**Architecture:** Extract deterministic reveal and journal data helpers into `src/reveal.mjs` and `src/journal.mjs`, while keeping DOM wiring in `src/app.mjs`. Use Canvas for scratch erasing, particles, and PNG export; use DOM elements for journal editing. Store sticker slices as transparent PNGs under `assets/journal-stickers/`.

**Tech Stack:** Native HTML, CSS, JavaScript ES modules, Canvas 2D, Node test runner, PowerShell/System.Drawing for one-time asset slicing.

---

### Task 1: Reveal Helper Module

**Files:**
- Create: `src/reveal.mjs`
- Modify: `tests/core.test.mjs`

- [ ] Add failing tests for interpolated soft-brush points, bounded particle spawning, particle expiry, and scratch-state reset.
- [ ] Run `npm.cmd test` and verify the new reveal tests fail because `src/reveal.mjs` does not exist.
- [ ] Implement `interpolateStroke`, `createScratchState`, `endScratch`, `spawnSandParticles`, and `advanceSandParticles`.
- [ ] Run `npm.cmd test` and verify all reveal helper tests pass.

### Task 2: Reliable Scratch Interaction and Flying Sand

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.mjs`
- Modify: `tests/core.test.mjs`

- [ ] Add failing structural tests for `sandParticleCanvas`, `pointercancel`, `lostpointercapture`, and soft radial-gradient erasing.
- [ ] Run `npm.cmd test` and verify the new interaction tests fail.
- [ ] Add the particle Canvas and wire scratch-state reset across dialog open/close and all pointer-end events.
- [ ] Replace hard line erasing with interpolated radial-gradient destination-out stamps.
- [ ] Animate bounded flying-sand particles and rotate the brush toward its movement direction.
- [ ] Run `npm.cmd test` and verify all interaction tests pass.

### Task 3: Polygon-Based Soft Region Reveals

**Files:**
- Modify: `src/app.mjs`
- Modify: `styles.css`
- Modify: `tests/core.test.mjs`

- [ ] Add a failing test proving rendered reveal markup consumes each region's `polygon` and includes inner and feather layers.
- [ ] Run `npm.cmd test` and verify the new reveal-layer test fails.
- [ ] Render polygon-clipped color layers with a blurred outer feather and a fully revealed completion layer.
- [ ] Tune overlap, opacity, and saturation transitions so neighboring revealed and sandified areas blend naturally.
- [ ] Run `npm.cmd test` and verify all region reveal tests pass.

### Task 4: Sticker Asset Slices and Manifest

**Files:**
- Create: `assets/journal-stickers/*.png`
- Create: `src/journal-stickers.mjs`
- Modify: `tests/core.test.mjs`

- [ ] Add a failing test requiring sticker categories and valid local PNG asset paths.
- [ ] Run `npm.cmd test` and verify the manifest test fails.
- [ ] Copy the supplied sticker sheet into the project as a source reference.
- [ ] Slice representative building, figure, plant, tape, note, label, frame, and icon assets into transparent PNG files.
- [ ] Create the sticker manifest with category, title, source, and default scale for every slice.
- [ ] Run `npm.cmd test` and verify the manifest test passes.

### Task 5: Journal Data Model, Migration, and Auto Layout

**Files:**
- Create: `src/journal.mjs`
- Modify: `tests/core.test.mjs`

- [ ] Add failing tests for v1 migration, auto-generated representative places, empty exploration guidance, and element ordering.
- [ ] Run `npm.cmd test` and verify the journal helper tests fail.
- [ ] Implement `migrateJournal`, `createAutoJournal`, `createJournalItem`, and `sortJournalItems`.
- [ ] Run `npm.cmd test` and verify all journal helper tests pass.

### Task 6: Mobile Bound-Paper Journal UI

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.mjs`
- Modify: `tests/core.test.mjs`

- [ ] Add failing structural tests for the bound-paper canvas, bottom journal toolbar, asset drawer, sticker categories, and floating selection toolbar.
- [ ] Run `npm.cmd test` and verify the journal UI tests fail.
- [ ] Replace the current button-heavy layout with the single-page ring-bound journal shell.
- [ ] Wire the bottom toolbar and drawers for stickers, text, photos, and discovered places.
- [ ] Render the auto-generated journal and support adding sticker-manifest assets.
- [ ] Move edit, rotate, scale, layer, and delete controls into a contextual floating toolbar.
- [ ] Support deselection on blank canvas and persist only after completed edits.
- [ ] Run `npm.cmd test` and verify all journal UI tests pass.

### Task 7: Journal Export and Persistence

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/journal.mjs`
- Modify: `tests/core.test.mjs`

- [ ] Add failing tests for the v2 storage key and export support for sticker, place, text, and photo elements.
- [ ] Run `npm.cmd test` and verify the persistence/export tests fail.
- [ ] Migrate old stored journal content into `yuditu:journal:v2`.
- [ ] Update Canvas export to render paper, fixed decoration, sticker images, photos, places, and text in layer order.
- [ ] Keep system sharing and PNG download fallbacks.
- [ ] Run `npm.cmd test` and verify all persistence/export tests pass.

### Task 8: Full Verification and Documentation Refresh

**Files:**
- Modify: `README.md`
- Modify: `docs/screenshots/*.png` if browser capture is available

- [ ] Run `node --check server.mjs`, `node --check src/core.mjs`, `node --check src/data.mjs`, `node --check src/reveal.mjs`, `node --check src/journal.mjs`, and `node --check src/app.mjs`.
- [ ] Run `npm.cmd test` and verify zero failures.
- [ ] Start the local server and verify region click, scratch retry after cancellation, visible sand particles, feathered region boundaries, journal auto-layout, sticker insertion, dragging, editing, persistence, and PNG export.
- [ ] Refresh README feature notes and screenshots to match the implemented journal.
- [ ] Run `git diff --check` and inspect `git status --short`.
