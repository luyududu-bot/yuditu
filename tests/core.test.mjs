import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { applyUnlock, buildRoute, parseGoal, progressFor } from "../src/core.mjs";
import { advanceSandParticles, createScratchState, endScratch, insetPolygon, interpolateStroke, spawnSandParticles } from "../src/reveal.mjs";
import { createAutoJournal, migrateJournal, sortJournalItems } from "../src/journal.mjs";
import { markerAnchors, places as campusPlaces, regions } from "../src/data.mjs";
import { journalStickers } from "../src/journal-stickers.mjs";
import { executeAction, getAvailableActions, listObjects, validateObjectData } from "../src/object-actions.mjs";

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

test("buildRoute only uses unlocked places and explains every stop", () => {
  const routePlaces = [
    { ...places[0], regionId: "east", x: 10, y: 10 },
    { ...places[1], regionId: "west", x: 12, y: 10 },
    { ...places[2], regionId: "south", x: 90, y: 90 },
  ];
  const route = buildRoute(routePlaces, parseGoal("第一次来，只有20分钟，想看代表性的地方"), { unlocked: ["east", "west"] });
  assert.deepEqual(route.stops.map((stop) => stop.id), ["museum", "thinker"]);
  assert.equal(route.stopReasons.length, 2);
  assert.ok(route.stopReasons.every((item) => item.reason.length > 0));
});

test("buildRoute prefers a nearby equally relevant next stop", () => {
  const routePlaces = [
    { id: "start", name: "起点", regionId: "east", x: 10, y: 10, tags: ["代表性"], metadata: { representativeScore: 1, visitMinutes: 3 } },
    { id: "near", name: "附近", regionId: "east", x: 14, y: 10, tags: ["代表性"], metadata: { representativeScore: .8, visitMinutes: 3 } },
    { id: "far", name: "远处", regionId: "east", x: 90, y: 90, tags: ["代表性"], metadata: { representativeScore: .8, visitMinutes: 3 } },
  ];
  const route = buildRoute(routePlaces, parseGoal("10分钟，想看代表性的地方"), { unlocked: ["east"] });
  assert.deepEqual(route.stops.slice(0, 2).map((stop) => stop.id), ["start", "near"]);
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
  assert.match(css, /\.region-reveal-mist/);
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

test("campus data includes all three annotated gates", () => {
  const gates = campusPlaces.filter((place) => place.category === "出入口");
  assert.deepEqual(gates.map((gate) => gate.name).sort(), ["东门", "北门", "南门"]);
  assert.ok(gates.every((gate) => gate.type === "entrance"));
  assert.ok(gates.every((gate) => gate.actions.includes("set_as_start")));
  const app = readFileSync(new URL("../src/app.mjs", import.meta.url), "utf8");
  assert.match(app, /marker-name-label/);
  assert.match(app, /edge-right/);
});

test("insetPolygon pulls the clear reveal core away from hard outer edges", () => {
  assert.equal(insetPolygon("0% 0%, 100% 0%, 100% 100%, 0% 100%", .8), "10% 10%, 90% 10%, 90% 90%, 10% 90%");
});

test("route focus renders an SVG path, ordered stops, explanations, and exit control", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.mjs", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(html, /<svg[^>]+id="routeLines"/);
  assert.match(html, /id="exitRouteButton"/);
  assert.match(app, /route-order/);
  assert.match(app, /stopReasons/);
  assert.match(app, /focusRoute/);
  assert.match(app, /routePathData/);
  assert.match(css, /\.route-focus/);
});

test("graphical marker categories expose normalized visual anchors", () => {
  ["展览", "服务", "补给", "打卡", "出入口"].forEach((category) => {
    assert.ok(markerAnchors[category]);
    assert.ok(markerAnchors[category].anchorX >= 0 && markerAnchors[category].anchorX <= 1);
    assert.ok(markerAnchors[category].anchorY >= 0 && markerAnchors[category].anchorY <= 1);
  });
  const app = readFileSync(new URL("../src/app.mjs", import.meta.url), "utf8");
  assert.match(app, /calibratedMarkerPoint/);
  assert.match(app, /--anchor-x/);
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /assets\/category-icons\/exhibition\.png/);
  assert.match(css, /\.marker-number\s*\{[^}]*left:\s*50%[^}]*top:\s*50%/s);
});

test("map icons and journal stickers use transparent cutout PNG assets", () => {
  const transparentAssets = [
    "assets/category-icons/exhibition.png",
    "assets/category-icons/service.png",
    "assets/category-icons/supply.png",
    "assets/category-icons/checkin.png",
    "assets/category-icons/entrance.png",
    ...journalStickers.map((sticker) => sticker.src.replace("./", "")),
  ];
  transparentAssets.forEach((asset) => {
    const bytes = readFileSync(new URL(`../${asset}`, import.meta.url));
    assert.equal(bytes.toString("ascii", 1, 4), "PNG", asset);
    assert.equal(bytes[25], 6, `${asset} must be RGBA PNG`);
  });
});

test("map icon cutouts retain opaque interiors instead of hollow paper gaps", () => {
  ["exhibition", "service", "supply", "checkin", "entrance"].forEach((name) => {
    const bytes = readFileSync(new URL(`../assets/category-icons/${name}.png`, import.meta.url));
    assert.ok(bytes.length > 0);
  });
  const cutoutScript = readFileSync(new URL("../tools/cutout_assets.py", import.meta.url), "utf8");
  assert.match(cutoutScript, /fill_internal_holes/);
  assert.match(cutoutScript, /fill_holes=name != "photo-frame"/);
});

test("revealed regions render core, edge, mist, and grain transition layers", () => {
  const app = readFileSync(new URL("../src/app.mjs", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(app, /region-reveal-core/);
  assert.match(app, /region-reveal-edge/);
  assert.match(app, /region-reveal-mist/);
  assert.match(app, /region-reveal-grain/);
  assert.match(css, /prefers-reduced-motion/);
});

test("object actions filter by unlocked state and dispatch through adapters", () => {
  const visible = listObjects(campusPlaces, { category: "展览" }, { unlocked: ["east"] });
  assert.ok(visible.some((place) => place.id === "museum"));
  assert.ok(visible.every((place) => place.regionId === "east"));
  assert.deepEqual(getAvailableActions(campusPlaces[0], { unlocked: [] }), []);
  const calls = [];
  const result = executeAction("open_detail", campusPlaces[0], { unlocked: ["east"], adapters: { open_detail: (object) => calls.push(object.id) } });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["museum"]);
});

test("object data validation catches broken references and unsupported actions", () => {
  const errors = validateObjectData(
    [{ id: "r1" }],
    [
      { id: "p1", regionId: "missing", actions: ["unknown"], relations: { nearby: ["ghost"] }, metadata: { representativeScore: 2, visitMinutes: 0 } },
      { id: "p1", regionId: "r1", actions: [], relations: {}, metadata: { representativeScore: .5, visitMinutes: 3 } },
    ],
  );
  assert.ok(errors.some((error) => error.code === "duplicate-id"));
  assert.ok(errors.some((error) => error.code === "invalid-region"));
  assert.ok(errors.some((error) => error.code === "dangling-relation"));
  assert.ok(errors.some((error) => error.code === "unknown-action"));
  assert.ok(errors.some((error) => error.code === "invalid-route-metadata"));
  assert.deepEqual(validateObjectData(regions, campusPlaces), []);
});

test("detail dialog exposes executable object action controls", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/app.mjs", import.meta.url), "utf8");
  assert.match(html, /id="detailActions"/);
  assert.match(app, /executeAction/);
  assert.match(app, /getAvailableActions/);
});
