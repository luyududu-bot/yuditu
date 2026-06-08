import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { applyUnlock, buildRoute, parseGoal, progressFor } from "../src/core.mjs";
import { advanceSandParticles, createScratchState, endScratch, interpolateStroke, spawnSandParticles } from "../src/reveal.mjs";
import { createAutoJournal, migrateJournal, sortJournalItems } from "../src/journal.mjs";
import { places as campusPlaces } from "../src/data.mjs";
import { journalStickers } from "../src/journal-stickers.mjs";

const places = [
  { id: "museum", name: "美术馆", tags: ["看展", "代表性", "第一次来"], metadata: { representativeScore: 0.98, visitMinutes: 8 } },
  { id: "thinker", name: "思考者", tags: ["打卡", "代表性", "第一次来"], metadata: { representativeScore: 0.91, visitMinutes: 5 } },
  { id: "canteen", name: "第一食堂", tags: ["补给", "吃饭"], metadata: { representativeScore: 0.5, visitMinutes: 12 } },
];

test("parseGoal extracts time and first-visit interests", () => {
  assert.deepEqual(parseGoal("我第一次来，只有20分钟，想看最有代表性的地方"), {
    timeBudgetMinutes: 20,
    interests: ["第一次来", "代表性"],
    needs: [],
  });
});

test("buildRoute respects time budget and explains recommendation", () => {
  const route = buildRoute(places, parseGoal("我第一次来，只有15分钟，想看最有代表性的地方"));
  assert.deepEqual(route.stops.map((stop) => stop.id), ["museum", "thinker"]);
  assert.equal(route.estimatedMinutes, 13);
  assert.match(route.reason, /15 分钟/);
});

test("unlock state stays unique and reports progress", () => {
  assert.deepEqual(applyUnlock(["north"], "north"), ["north"]);
  assert.deepEqual(applyUnlock(["north"], "east"), ["north", "east"]);
  assert.equal(progressFor(["north", "east"]), 50);
});

test("transparent map layers do not block region and marker controls", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.region-layer,\s*\.marker-layer,\s*\.route-lines\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.region-chip,\s*\.marker\s*\{[^}]*pointer-events:\s*auto/s);
});

test("map reveals independent region layers instead of changing global opacity", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.mjs", import.meta.url), "utf8");
  assert.match(html, /id="revealLayer"/);
  assert.match(app, /region-reveal/);
  assert.match(app, /complete-reveal/);
  assert.doesNotMatch(app, /sandOverlay"\)\.style\.opacity/);
});

test("interface exposes journal entry and user-provided visual assets", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.mjs", import.meta.url), "utf8");
  assert.match(html, /id="journalButton"/);
  assert.match(html, /id="journalScreen"/);
  assert.match(html, /assets\/brush-character\.png/);
  assert.match(app, /category-icon/);
  assert.match(app, /building-number/);
});

test("scratch interaction uses a canvas for local sand erasing", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.mjs", import.meta.url), "utf8");
  assert.match(html, /<canvas[^>]+id="scratchCanvas"/);
  assert.match(app, /destination-out/);
  assert.match(app, /getImageData/);
});

test("map supports feathered reveals and focused region navigation", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.mjs", import.meta.url), "utf8");
  assert.match(html, /id="zoomInButton"/);
  assert.match(html, /id="zoomOutButton"/);
  assert.match(html, /id="resetViewButton"/);
  assert.match(css, /mask-image:/);
  assert.match(app, /focusRegion/);
  assert.match(app, /mapTransform/);
});

test("journal is a persistent DIY canvas with uploads and PNG export", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.mjs", import.meta.url), "utf8");
  assert.match(html, /id="journalCanvas"/);
  assert.match(html, /id="photoInput"/);
  assert.match(html, /id="addTextButton"/);
  assert.match(html, /id="addStickerButton"/);
  assert.match(html, /id="exportJournalButton"/);
  assert.match(html, /id="editItemButton"/);
  assert.match(app, /yuditu:journal/);
  assert.match(app, /renderJournalToCanvas/);
  assert.match(app, /toDataURL\("image\/png"/);
  assert.match(app, /navigator\.share/);
});

test("scratch helpers interpolate strokes and reset cancelled input", () => {
  assert.deepEqual(interpolateStroke({ x: 0, y: 0 }, { x: 30, y: 0 }, 10), [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 },
  ]);
  assert.deepEqual(endScratch({ ...createScratchState(), active: true, pointerId: 3, lastPoint: { x: 1, y: 2 } }), createScratchState());
});

test("sand particles stay bounded and expire", () => {
  const particles = spawnSandParticles([], { x: 20, y: 20 }, { x: 10, y: 10 }, { count: 400, max: 80, random: () => .5 });
  assert.equal(particles.length, 80);
  assert.equal(advanceSandParticles(particles, 5000).length, 0);
});

test("journal migrates old items and auto-generates representative places", () => {
  const migrated = migrateJournal([{ id: "old", type: "text", text: "旧文字", x: 10, y: 20, z: 1 }, { id: "old-sticker", type: "sticker", text: "✦" }]);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.items[0].rotation, 0);
  assert.equal(migrated.items[1].type, "label");
  const journal = createAutoJournal(campusPlaces, ["east", "west"], "2026-06-08");
  assert.equal(journal.version, 2);
  assert.ok(journal.items.some((item) => item.type === "place" && item.placeId === "museum"));
  assert.deepEqual(sortJournalItems([{ id: "b", z: 2 }, { id: "a", z: 1 }]).map((item) => item.id), ["a", "b"]);
});

test("immersive reveal exposes particle canvas, cancellation recovery, and polygon feathers", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.mjs", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(html, /id="sandParticleCanvas"/);
  assert.match(app, /pointercancel/);
  assert.match(app, /lostpointercapture/);
  assert.match(app, /region\.polygon/);
  assert.match(css, /\.region-reveal-feather/);
  assert.match(app, /createRadialGradient/);
});

test("journal uses bound paper, contextual tools, drawers, and real sticker assets", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /journal-rings/);
  assert.match(html, /id="journalDrawer"/);
  assert.match(html, /id="journalSelectionTools"/);
  assert.ok(journalStickers.length >= 8);
  journalStickers.forEach((sticker) => assert.ok(existsSync(new URL(`../${sticker.src.replace("./", "")}`, import.meta.url)), sticker.src));
});
