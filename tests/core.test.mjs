import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyUnlock, buildRoute, parseGoal, progressFor } from "../src/core.mjs";

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
