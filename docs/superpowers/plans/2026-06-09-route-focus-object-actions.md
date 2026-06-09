# Route Focus, Visual Anchors, and Object Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a route-focused map experience, align asymmetric landmark icons, soften reveal boundaries into natural sand mist, and make object actions executable.

**Architecture:** Keep deterministic route and object behavior in focused ES modules, while `src/app.mjs` connects those helpers to the DOM. Render route geometry with SVG, apply category-level normalized visual anchors to markers, and build reveal transitions from multiple clipped layers.

**Tech Stack:** Native JavaScript ES modules, Node test runner, HTML, CSS, SVG, Canvas 2D.

---

### Task 1: Route Planning Model

**Files:**
- Modify: `tests/core.test.mjs`
- Modify: `src/core.mjs`

- [ ] Add failing tests proving routes only use unlocked regions, stay inside the time budget, include per-stop reasons, and prefer a nearby second stop over a distant equally scored stop.
- [ ] Run `npm.cmd test` and confirm the route tests fail because `buildRoute` does not accept route context or return stop reasons.
- [ ] Extend `buildRoute(places, goal, context)` with unlocked-region filtering, distance-aware selection, and `route.stopReasons`.
- [ ] Run `npm.cmd test` and confirm all route model tests pass.
- [ ] Commit route model changes.

### Task 2: Route Focus Rendering

**Files:**
- Modify: `tests/core.test.mjs`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.mjs`

- [ ] Add failing structural tests for SVG route paths, route-order badges, route-focus mode, per-stop explanations, and an exit-route command.
- [ ] Run `npm.cmd test` and confirm the route-focus tests fail.
- [ ] Replace the empty route layer with SVG, render calibrated route points and smooth paths, hide unrelated markers and region controls, and focus the map on the route bounds.
- [ ] Render per-stop reasons and wire the exit-route command to restore normal exploration.
- [ ] Run `npm.cmd test` and confirm all route-focus tests pass.
- [ ] Commit route focus changes.

### Task 3: Visual Marker Anchors

**Files:**
- Modify: `tests/core.test.mjs`
- Modify: `src/data.mjs`
- Modify: `styles.css`
- Modify: `src/app.mjs`

- [ ] Add failing tests requiring normalized anchors for every graphical marker category and shared calibrated-center usage by markers and routes.
- [ ] Run `npm.cmd test` and confirm the anchor tests fail.
- [ ] Add centralized `markerAnchors`, expose a calibrated coordinate helper, and render CSS anchor variables for graphical markers.
- [ ] Use calibrated coordinates for SVG paths and route-order badges.
- [ ] Run `npm.cmd test` and confirm all anchor tests pass.
- [ ] Commit visual anchor changes.

### Task 4: Natural Sand-Mist Reveal

**Files:**
- Modify: `tests/core.test.mjs`
- Modify: `styles.css`
- Modify: `src/app.mjs`

- [ ] Add failing tests requiring core, near-edge, outer-mist, and grain reveal layers.
- [ ] Run `npm.cmd test` and confirm the sand-mist tests fail.
- [ ] Render the four reveal layers per unlocked polygon with varied offsets and CSS masking/noise treatment.
- [ ] Add reduced-motion behavior and retain full-color completion behavior.
- [ ] Run `npm.cmd test` and confirm all reveal tests pass.
- [ ] Commit sand-mist reveal changes.

### Task 5: Object Actions and Validation

**Files:**
- Create: `src/object-actions.mjs`
- Modify: `tests/core.test.mjs`
- Modify: `src/data.mjs`
- Modify: `index.html`
- Modify: `src/app.mjs`

- [ ] Add failing tests for object filtering, action availability, action dispatch, duplicate IDs, invalid regions, dangling relations, unknown actions, and invalid route metadata.
- [ ] Run `npm.cmd test` and confirm object-action tests fail because the module does not exist.
- [ ] Implement `listObjects`, `getObject`, `getAvailableActions`, `executeAction`, and `validateObjectData`.
- [ ] Repair dangling relations and normalize supported action declarations in `src/data.mjs`.
- [ ] Add real action buttons to the detail dialog and connect them through `executeAction`.
- [ ] Run `npm.cmd test` and confirm all action and validation tests pass.
- [ ] Commit object action changes.

### Task 6: Full Verification and Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/object-model.md`
- Modify: `docs/screenshots/*.png` when browser capture is available

- [ ] Update documentation for unlocked-only route planning, route focus mode, visual anchors, and executable actions.
- [ ] Run syntax checks for every JavaScript module.
- [ ] Run `npm.cmd test` and confirm zero failures.
- [ ] Start the local server and verify route generation, route exit, marker alignment, reveal edges, detail actions, and journal insertion in the browser.
- [ ] Run `git diff --check` and inspect `git status --short`.
- [ ] Commit documentation and verification artifacts.
