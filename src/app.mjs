import { applyUnlock, buildRoute, parseGoal, progressFor } from "./core.mjs";
import { markerAnchors, places, regions } from "./data.mjs";
import { advanceSandParticles, createScratchState, endScratch, insetPolygon, interpolateStroke, spawnSandParticles } from "./reveal.mjs";
import { createAutoJournal, createJournalItem, migrateJournal, sortJournalItems } from "./journal.mjs";
import { journalStickers } from "./journal-stickers.mjs";
import { executeAction, getAvailableActions } from "./object-actions.mjs";

const $ = (selector) => document.querySelector(selector);
const state = {
  unlocked: JSON.parse(localStorage.getItem("yuditu:unlocked") || "[]"),
  activeRegion: null,
  category: "全部",
  routeStops: [],
  routeReasons: [],
  mapView: { scale: 1, x: 0, y: 0 },
  journal: migrateJournal(JSON.parse(localStorage.getItem("yuditu:journal:v2") || localStorage.getItem("yuditu:journal") || "[]")),
  selectedJournalId: null,
  journalDrawer: null,
  journalCleared: localStorage.getItem("yuditu:journal:cleared") === "true",
};

const hero = $("#hero");
const mapScreen = $("#mapScreen");
const journalScreen = $("#journalScreen");
const bottomNav = $("#bottomNav");
const mapStage = $("#mapStage");
const mapTransform = $("#mapTransform");
const regionLayer = $("#regionLayer");
const revealLayer = $("#revealLayer");
const markerLayer = $("#markerLayer");
const unlockDialog = $("#unlockDialog");
const detailDialog = $("#detailDialog");
const scratchArea = $("#scratchArea");
const scratchCanvas = $("#scratchCanvas");
const scratchContext = scratchCanvas.getContext("2d", { willReadFrequently: true });
const sandParticleCanvas = $("#sandParticleCanvas");
const sandParticleContext = sandParticleCanvas.getContext("2d");
const journalCanvas = $("#journalCanvas");
let scratchState = createScratchState();
let scratchChecks = 0;
let sandParticles = [];
let particleFrame = null;
let lastParticleTime = performance.now();
let draggingMap = false;
let mapDragStart = null;
let journalDrag = null;

function iconClassFor(category) {
  return { 展览: "icon-exhibition", 服务: "icon-service", 补给: "icon-supply", 打卡: "icon-checkin", 出入口: "icon-entrance" }[category] || "icon-service";
}

function calibratedMarkerPoint(place) {
  if (place.type === "place") return { x: place.x, y: place.y };
  const anchor = markerAnchors[place.category] || { anchorX: .5, anchorY: .5 };
  return {
    x: place.x + (.5 - anchor.anchorX) * 4,
    y: place.y + (.5 - anchor.anchorY) * 4,
  };
}

function persist() {
  localStorage.setItem("yuditu:unlocked", JSON.stringify(state.unlocked));
}

function persistJournal() {
  try {
    localStorage.setItem("yuditu:journal:v2", JSON.stringify(state.journal));
  } catch {
    showToast("照片较大，手账暂时无法自动保存，但仍可继续编辑与导出");
  }
}

function render() {
  const progress = progressFor(state.unlocked);
  $("#progressText").textContent = `${progress}%`;
  $("#progressBar").style.width = `${progress}%`;
  $("#mapHint").textContent = progress === 100 ? "校园已完整显影，可放大漫游每一处故事" : "点击区域显影；已解锁区域可再次点击聚焦";

  revealLayer.innerHTML = state.unlocked.length === regions.length
    ? `<div class="region-reveal complete-reveal" data-reveal="complete"></div>`
    : regions.filter((region) => state.unlocked.includes(region.id)).map((region) =>
      `<div class="region-reveal-mist" style="clip-path:polygon(${region.polygon})"></div>
       <div class="region-reveal-edge" style="clip-path:polygon(${insetPolygon(region.polygon, .96)})"></div>
       <div class="region-reveal-grain" style="clip-path:polygon(${region.polygon})"></div>
       <div class="region-reveal region-reveal-core" data-reveal="${region.id}" style="clip-path:polygon(${insetPolygon(region.polygon, .88)})"></div>`
    ).join("");

  regionLayer.innerHTML = regions.map((region) => `
    <button class="region-chip ${state.unlocked.includes(region.id) ? "unlocked" : ""}"
      data-region="${region.id}" style="left:${region.x}%;top:${region.y}%">
      ${state.unlocked.includes(region.id) ? "✓ " : ""}${region.name}
    </button>`).join("");

  markerLayer.innerHTML = places.map((place) => {
    const routeStop = state.routeStops.includes(place.id);
    const visible = state.unlocked.includes(place.regionId) && (state.routeStops.length ? routeStop : state.category === "全部" || state.category === place.category);
    const routeOrder = state.routeStops.indexOf(place.id) + 1;
    const point = calibratedMarkerPoint(place);
    const anchor = markerAnchors[place.category] || { anchorX: .5, anchorY: .5 };
    const numberBadge = /^\d+$/.test(place.number || "") ? `<i class="marker-number">${place.number}</i>` : "";
    const markerContent = place.type === "place"
      ? `<span class="building-number">${place.number}</span>`
      : `<span class="category-icon ${iconClassFor(place.category)}" aria-hidden="true"></span>${numberBadge}`;
    return `<button class="marker ${place.type === "place" ? "building-marker" : "asset-marker"} ${visible ? "visible" : ""} ${routeStop ? "route-stop" : ""} ${state.routeStops.length && !routeStop ? "route-hidden" : ""}"
      data-place="${place.id}" style="left:${point.x}%;top:${point.y}%;--anchor-x:${anchor.anchorX};--anchor-y:${anchor.anchorY}" aria-label="${place.name}">${markerContent}${routeStop ? `<i class="route-order">${routeOrder}</i>` : ""}</button>`;
  }).join("");
  renderRouteLines();
  mapStage.classList.toggle("route-focus", state.routeStops.length > 0);

  regionLayer.querySelectorAll("[data-region]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.region;
    state.unlocked.includes(id) ? focusRegion(id) : openUnlock(id);
  }));
  markerLayer.querySelectorAll("[data-place]").forEach((button) => button.addEventListener("click", () => openDetail(button.dataset.place)));
  renderJournal();
}

function renderRouteLines() {
  const points = state.routeStops.map((id) => calibratedMarkerPoint(places.find((place) => place.id === id)));
  if (points.length < 2) {
    $("#routeLines").innerHTML = "";
    return;
  }
  const path = routePathData(points);
  $("#routeLines").innerHTML = `<path class="route-path-shadow" d="${path}"></path><path class="route-path" d="${path}"></path>`;
}

function routePathData(points) {
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const dx = point.x - previous.x;
    return `${path} C ${previous.x + dx * .35} ${previous.y}, ${point.x - dx * .35} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function focusRoute() {
  const points = state.routeStops.map((id) => calibratedMarkerPoint(places.find((place) => place.id === id)));
  if (!points.length) return;
  const rect = mapStage.getBoundingClientRect();
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(24, Math.max(...xs) - Math.min(...xs) + 18);
  const height = Math.max(24, Math.max(...ys) - Math.min(...ys) + 18);
  const scale = Math.min(2.5, Math.max(1.15, Math.min(100 / width, 100 / height)));
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  setMapView(scale, (50 - centerX) / 100 * rect.width * scale, (50 - centerY) / 100 * rect.height * scale);
}

function applyMapTransform() {
  const { scale, x, y } = state.mapView;
  mapTransform.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function setMapView(scale, x = state.mapView.x, y = state.mapView.y) {
  state.mapView = { scale: Math.max(1, Math.min(3, scale)), x, y };
  if (state.mapView.scale === 1) state.mapView.x = state.mapView.y = 0;
  applyMapTransform();
}

function focusRegion(regionId) {
  const region = regions.find((item) => item.id === regionId);
  const rect = mapStage.getBoundingClientRect();
  const scale = 2.05;
  const x = (50 - region.x) / 100 * rect.width * scale;
  const y = (50 - region.y) / 100 * rect.height * scale;
  setMapView(scale, x, y);
  const note = $("#regionFocusNote");
  note.innerHTML = `<strong>${region.name} · ${region.subtitle}</strong>拖动地图查看细节，点击“全图”继续探索`;
  note.classList.remove("is-hidden");
}

function resetMapView() {
  setMapView(1, 0, 0);
  $("#regionFocusNote").classList.add("is-hidden");
}

function initializeScratchCanvas() {
  const rect = scratchArea.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  scratchCanvas.width = Math.round(rect.width * ratio);
  scratchCanvas.height = Math.round(rect.height * ratio);
  sandParticleCanvas.width = scratchCanvas.width;
  sandParticleCanvas.height = scratchCanvas.height;
  sandParticleCanvas.style.width = `${rect.width}px`;
  sandParticleCanvas.style.height = `${rect.height}px`;
  scratchState = createScratchState();
  sandParticles = [];
  sandParticleContext.clearRect(0, 0, sandParticleCanvas.width, sandParticleCanvas.height);
  scratchContext.globalCompositeOperation = "source-over";
  scratchContext.fillStyle = "#d9c1a1";
  scratchContext.fillRect(0, 0, scratchCanvas.width, scratchCanvas.height);
  const image = new Image();
  image.onload = () => {
    scratchContext.save();
    scratchContext.filter = "sepia(1) saturate(.42) brightness(.94) contrast(1.04)";
    scratchContext.drawImage(image, 0, 0, scratchCanvas.width, scratchCanvas.height);
    scratchContext.restore();
  };
  image.src = "./assets/map.jpg";
}

function openUnlock(regionId) {
  state.activeRegion = regionId;
  scratchState = createScratchState();
  scratchChecks = 0;
  $("#scratchBar").style.width = "0";
  $("#scratchText").textContent = "显影 0%";
  $("#unlockTitle").textContent = `唤醒${regions.find((region) => region.id === regionId).name}`;
  unlockDialog.showModal();
  requestAnimationFrame(initializeScratchCanvas);
}

function eraseScratch(x, y, previous) {
  const sx = scratchCanvas.width / scratchArea.clientWidth;
  const sy = scratchCanvas.height / scratchArea.clientHeight;
  interpolateStroke(previous, { x, y }, 8).forEach((point) => {
    scratchContext.save();
    scratchContext.globalCompositeOperation = "destination-out";
    const radius = 36 * sx;
    const gradient = scratchContext.createRadialGradient(point.x * sx, point.y * sy, radius * .18, point.x * sx, point.y * sy, radius);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(.55, "rgba(0,0,0,.82)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    scratchContext.fillStyle = gradient;
    scratchContext.beginPath();
    scratchContext.arc(point.x * sx, point.y * sy, radius, 0, Math.PI * 2);
    scratchContext.fill();
    scratchContext.restore();
  });
}

function erasedPercent() {
  const data = scratchContext.getImageData(0, 0, scratchCanvas.width, scratchCanvas.height).data;
  let cleared = 0;
  const step = 64;
  for (let i = 3; i < data.length; i += step) if (data[i] < 40) cleared++;
  return Math.min(100, Math.round(cleared / (data.length / step) * 100));
}

function updateScratch(event) {
  if (!scratchState.active || !state.activeRegion) return;
  const rect = scratchArea.getBoundingClientRect();
  const point = { x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)) };
  $("#brushCursor").style.left = `${point.x}px`;
  $("#brushCursor").style.top = `${point.y}px`;
  if (scratchState.lastPoint) {
    const angle = Math.atan2(point.y - scratchState.lastPoint.y, point.x - scratchState.lastPoint.x) * 180 / Math.PI;
    $("#brushCursor").style.transform = `translate(-50%, -50%) rotate(${angle + 72}deg)`;
    sandParticles = spawnSandParticles(sandParticles, point, scratchState.lastPoint, { count: matchMedia("(prefers-reduced-motion: reduce)").matches ? 2 : 7 });
    startParticleAnimation();
  }
  eraseScratch(point.x, point.y, scratchState.lastPoint);
  scratchState.lastPoint = point;
  if (++scratchChecks % 4 !== 0) return;
  const percent = erasedPercent();
  $("#scratchBar").style.width = `${percent}%`;
  $("#scratchText").textContent = `显影 ${percent}%`;
  if (percent >= 60) finishUnlock();
}

function finishUnlock() {
  scratchState = endScratch();
  const region = regions.find((item) => item.id === state.activeRegion);
  state.unlocked = applyUnlock(state.unlocked, state.activeRegion);
  persist();
  unlockDialog.close();
  state.activeRegion = null;
  render();
  requestAnimationFrame(() => focusRegion(region.id));
  showToast(`${region.name}显影完成，已为你放大这片校园`);
}

function drawSandParticles(now) {
  const elapsed = Math.min(40, now - lastParticleTime);
  lastParticleTime = now;
  sandParticles = advanceSandParticles(sandParticles, elapsed);
  const sx = sandParticleCanvas.width / scratchArea.clientWidth;
  sandParticleContext.clearRect(0, 0, sandParticleCanvas.width, sandParticleCanvas.height);
  sandParticles.forEach((particle) => {
    sandParticleContext.save();
    sandParticleContext.globalAlpha = 1 - particle.age / particle.life;
    sandParticleContext.translate(particle.x * sx, particle.y * sx);
    sandParticleContext.rotate(particle.rotation);
    sandParticleContext.fillStyle = particle.radius > 3 ? "#c99b62" : "#ead2a6";
    sandParticleContext.fillRect(-particle.radius * sx, -particle.radius * .45 * sx, particle.radius * 2 * sx, particle.radius * .9 * sx);
    sandParticleContext.restore();
  });
  particleFrame = sandParticles.length ? requestAnimationFrame(drawSandParticles) : null;
}

function startParticleAnimation() {
  if (particleFrame) return;
  lastParticleTime = performance.now();
  particleFrame = requestAnimationFrame(drawSandParticles);
}

function stopScratch() {
  scratchState = endScratch();
}

function openDetail(id) {
  const place = places.find((item) => item.id === id);
  $("#detailCategory").textContent = place.category;
  $("#detailName").textContent = place.name;
  $("#detailDescription").textContent = place.metadata.description;
  $("#detailTags").innerHTML = [...place.tags, ...place.metadata.facilities].map((tag) => `<span>${tag}</span>`).join("");
  $("#detailObject").textContent = `${place.type} · actions: ${place.actions.join(", ")}`;
  const actions = getAvailableActions(place, { unlocked: state.unlocked });
  const labels = { open_detail: "查看详情", focus_on_object: "地图聚焦", add_to_route: "加入路线", create_journal: "加入手账", set_as_start: "设为起点" };
  $("#detailActions").innerHTML = actions.filter((action) => action !== "open_detail").map((action) => `<button data-object-action="${action}">${labels[action] || action}</button>`).join("");
  $("#detailActions").querySelectorAll("[data-object-action]").forEach((button) => button.addEventListener("click", () => runObjectAction(button.dataset.objectAction, place)));
  detailDialog.showModal();
}

function runObjectAction(actionId, place) {
  const adapters = {
    focus_on_object: (object) => {
      detailDialog.close();
      const rect = mapStage.getBoundingClientRect();
      const point = calibratedMarkerPoint(object);
      setMapView(2.15, (50 - point.x) / 100 * rect.width * 2.15, (50 - point.y) / 100 * rect.height * 2.15);
      showToast(`已聚焦 ${object.name}`);
    },
    add_to_route: (object) => {
      if (!state.routeStops.includes(object.id)) state.routeStops.push(object.id);
      detailDialog.close();
      render();
      requestAnimationFrame(focusRoute);
      showToast(`${object.name}已加入路线`);
    },
    create_journal: (object) => {
      detailDialog.close();
      addPlaceToJournal(object.id);
      showScreen("journal");
    },
    set_as_start: (object) => {
      state.routeStops = [object.id, ...state.routeStops.filter((id) => id !== object.id)];
      detailDialog.close();
      render();
      requestAnimationFrame(focusRoute);
      showToast(`${object.name}已设为路线起点`);
    },
  };
  const result = executeAction(actionId, place, { unlocked: state.unlocked, adapters });
  if (!result.ok) showToast("当前状态下无法执行此操作");
}

function showToast(text) {
  const toast = $("#toast");
  toast.textContent = text;
  toast.classList.remove("is-hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("is-hidden"), 2600);
}

function showScreen(screen) {
  const showMap = screen === "map";
  mapScreen.classList.toggle("is-hidden", !showMap);
  journalScreen.classList.toggle("is-hidden", showMap);
  $("#mapButton").classList.toggle("active", showMap);
  $("#journalButton").classList.toggle("active", !showMap);
  if (!showMap) renderJournal();
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addJournalItem(item) {
  const offset = state.journal.items.length % 6;
  state.journal.items.push(createJournalItem(item.type, { x: 28 + offset * 8, y: 25 + offset * 9, rotation: (offset - 2) * 3, ...item }, state.journal.items.length));
  state.selectedJournalId = state.journal.items.at(-1).id;
  state.journalCleared = false;
  state.journalDrawer = null;
  localStorage.removeItem("yuditu:journal:cleared");
  persistJournal();
  renderJournal();
}

function defaultJournal() {
  if (state.journal.items.length || state.journalCleared) return;
  state.journal = createAutoJournal(places, state.unlocked);
  persistJournal();
}

function renderJournal() {
  defaultJournal();
  const discovered = places.filter((place) => state.unlocked.includes(place.regionId));
  $("#journalProgress").textContent = `已显影 ${state.unlocked.length} / 4 片校园之屿 · 发现 ${discovered.length} 个地点。拖动素材自由排版，点选后可缩放与旋转。`;
  journalCanvas.innerHTML = sortJournalItems(state.journal.items).map((item) => {
    const style = `left:${item.x}%;top:${item.y}%;--rotation:${item.rotation}deg;--scale:${item.scale};z-index:${item.z}`;
    const selected = item.id === state.selectedJournalId ? "selected" : "";
    if (item.type === "photo" || item.type === "sticker") return `<div class="journal-item ${item.type} ${selected}" data-journal-id="${item.id}" style="${style}"><img src="${item.src}" alt="${item.title || "手账素材"}" /></div>`;
    if (item.type === "place") return `<div class="journal-item place ${selected}" data-journal-id="${item.id}" style="${style}"><b>${item.number}</b><span>${item.name}<small>${item.category}</small></span></div>`;
    return `<div class="journal-item ${item.type} ${selected}" data-journal-id="${item.id}" style="${style}">${item.text}</div>`;
  }).join("");
  journalCanvas.querySelectorAll("[data-journal-id]").forEach((element) => element.addEventListener("pointerdown", startJournalDrag));
  $("#journalPlaceList").innerHTML = discovered.length
    ? discovered.map((place) => `<button data-add-place="${place.id}"><b>${place.number}</b><span>${place.name}<small>${place.category}</small></span></button>`).join("")
    : `<p class="journal-empty">先去地图显影区域，发现的地点会成为手账素材。</p>`;
  $("#journalPlaceList").querySelectorAll("[data-add-place]").forEach((button) => button.addEventListener("click", () => addPlaceToJournal(button.dataset.addPlace)));
  $("#journalSelectionTools").classList.toggle("is-hidden", !state.selectedJournalId);
  renderJournalDrawer();
}

function renderJournalDrawer() {
  const drawer = $("#journalDrawer");
  drawer.classList.toggle("is-hidden", !state.journalDrawer);
  if (!state.journalDrawer) return;
  $("#journalDrawerTitle").textContent = state.journalDrawer === "stickers" ? "选择一枚贴纸" : "选择发现地点";
  $("#stickerCategories").classList.toggle("is-hidden", state.journalDrawer !== "stickers");
  $("#journalPlaceList").classList.toggle("is-hidden", state.journalDrawer !== "places");
  if (state.journalDrawer === "stickers") {
    $("#stickerCategories").innerHTML = journalStickers.map((sticker) => `<button data-sticker="${sticker.id}"><img src="${sticker.src}" alt="${sticker.title}"><span>${sticker.category}</span></button>`).join("");
    $("#stickerCategories").querySelectorAll("[data-sticker]").forEach((button) => button.addEventListener("click", () => {
      const sticker = journalStickers.find((item) => item.id === button.dataset.sticker);
      addJournalItem({ type: "sticker", src: sticker.src, title: sticker.title, scale: sticker.scale });
    }));
  }
}

function startJournalDrag(event) {
  event.preventDefault();
  const id = event.currentTarget.dataset.journalId;
  state.selectedJournalId = id;
  const item = state.journal.items.find((entry) => entry.id === id);
  journalDrag = { id, startX: event.clientX, startY: event.clientY, x: item.x, y: item.y };
  event.currentTarget.setPointerCapture(event.pointerId);
  journalCanvas.querySelectorAll(".journal-item").forEach((element) => element.classList.toggle("selected", element.dataset.journalId === id));
}

function moveJournalItem(event) {
  if (!journalDrag) return;
  const rect = journalCanvas.getBoundingClientRect();
  const item = state.journal.items.find((entry) => entry.id === journalDrag.id);
  item.x = Math.max(4, Math.min(96, journalDrag.x + (event.clientX - journalDrag.startX) / rect.width * 100));
  item.y = Math.max(4, Math.min(96, journalDrag.y + (event.clientY - journalDrag.startY) / rect.height * 100));
  const element = journalCanvas.querySelector(`[data-journal-id="${item.id}"]`);
  if (element) {
    element.style.left = `${item.x}%`;
    element.style.top = `${item.y}%`;
  }
}

function endJournalDrag() {
  if (!journalDrag) return;
  journalDrag = null;
  persistJournal();
}

function mutateSelected(callback) {
  const item = state.journal.items.find((entry) => entry.id === state.selectedJournalId);
  if (!item) return showToast("先点选一个手账素材");
  callback(item);
  persistJournal();
  renderJournal();
}

function addPlaceToJournal(id) {
  const place = places.find((entry) => entry.id === id);
  addJournalItem({ type: "place", name: place.name, number: place.number, category: place.category });
}

function roundedRect(context, x, y, width, height, radius, fill) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
}

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.src = src;
  });
}

async function renderJournalToCanvas() {
  const output = document.createElement("canvas");
  output.width = 1200;
  output.height = 1500;
  const context = output.getContext("2d");
  context.fillStyle = "#f8f0df";
  context.fillRect(0, 0, output.width, output.height);
  context.strokeStyle = "rgba(110,75,55,.08)";
  for (let x = 0; x < output.width; x += 55) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, output.height); context.stroke(); }
  for (let y = 0; y < output.height; y += 55) { context.beginPath(); context.moveTo(0, y); context.lineTo(output.width, y); context.stroke(); }
  for (const item of sortJournalItems(state.journal.items)) {
    context.save();
    context.translate(item.x / 100 * output.width, item.y / 100 * output.height);
    context.rotate(item.rotation * Math.PI / 180);
    context.scale(item.scale, item.scale);
    if (item.type === "photo") {
      roundedRect(context, -160, -135, 320, 300, 5, "#fffdf8");
      const image = await loadImage(item.src);
      context.drawImage(image, -145, -120, 290, 230);
    } else if (item.type === "sticker") {
      const image = await loadImage(item.src);
      context.drawImage(image, -150, -100, 300, 200);
    } else if (item.type === "place") {
      roundedRect(context, -155, -45, 310, 90, 10, "#fffaf0");
      context.fillStyle = "#cf766f"; context.beginPath(); context.arc(-112, 0, 28, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#fff"; context.font = "bold 22px sans-serif"; context.textAlign = "center"; context.fillText(item.number, -112, 8);
      context.fillStyle = "#4d352d"; context.font = "bold 24px serif"; context.textAlign = "left"; context.fillText(item.name, -70, 0);
      context.fillStyle = "#8c7165"; context.font = "16px sans-serif"; context.fillText(item.category, -70, 25);
    } else if (item.type === "sticker") {
      context.fillStyle = "#cf766f"; context.beginPath(); context.arc(0, 0, 52, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#fff"; context.font = "56px serif"; context.textAlign = "center"; context.fillText(item.text, 0, 20);
    } else {
      context.fillStyle = "#4d352d"; context.font = "bold 34px serif"; context.textAlign = "center"; context.fillText(item.text, 0, 0);
    }
    context.restore();
  }
  context.fillStyle = "#a95655"; context.font = "bold 18px sans-serif"; context.textAlign = "right"; context.fillText("屿地图 · CAFA CAMPUS JOURNAL", 1160, 1460);
  return output;
}

async function exportJournal() {
  const output = await renderJournalToCanvas();
  const dataUrl = output.toDataURL("image/png");
  const blob = await new Promise((resolve) => output.toBlob(resolve, "image/png"));
  const file = new File([blob], `屿地图-校园手账-${new Date().toISOString().slice(0, 10)}.png`, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: "我的屿地图校园手账", files: [file] });
      showToast("手账已打开系统分享");
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `屿地图-校园手账-${new Date().toISOString().slice(0, 10)}.png`;
  link.click();
  showToast("手账图片已生成，可以保存或分享");
}

$("#enterButton").addEventListener("click", () => { hero.classList.add("is-hidden"); mapScreen.classList.remove("is-hidden"); bottomNav.classList.remove("is-hidden"); render(); });
$("#heroJournalButton").addEventListener("click", () => { hero.classList.add("is-hidden"); bottomNav.classList.remove("is-hidden"); showScreen("journal"); render(); });
$("#goalToggle").addEventListener("click", () => $("#goalForm").classList.toggle("is-hidden"));
$("#goalForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const route = buildRoute(places, parseGoal($("#goalInput").value), { unlocked: state.unlocked });
  state.routeStops = route.stops.map((place) => place.id);
  state.routeReasons = route.stopReasons;
  $("#routeResult").innerHTML = `<strong>${route.estimatedMinutes} 分钟 · ${route.stops.map((stop) => stop.name).join(" → ") || "暂无路线"}</strong>${route.reason}${route.stopReasons.map((item, index) => `<span>${index + 1}. ${route.stops[index].name}：${item.reason}</span>`).join("")}`;
  $("#routeResult").classList.remove("is-hidden");
  $("#exitRouteButton").classList.toggle("is-hidden", !state.routeStops.length);
  render();
  requestAnimationFrame(focusRoute);
});
$("#exitRouteButton").addEventListener("click", () => {
  state.routeStops = [];
  state.routeReasons = [];
  $("#routeResult").classList.add("is-hidden");
  $("#exitRouteButton").classList.add("is-hidden");
  resetMapView();
  render();
});
$("#resetButton").addEventListener("click", () => { if (confirm("重新覆盖校园尘沙并清除显影进度？")) { state.unlocked = []; state.routeStops = []; persist(); resetMapView(); render(); } });
$("#closeUnlock").addEventListener("click", () => { stopScratch(); unlockDialog.close(); });
$("#closeDetail").addEventListener("click", () => detailDialog.close());
$("#mapButton").addEventListener("click", () => showScreen("map"));
$("#journalButton").addEventListener("click", () => showScreen("journal"));
$("#journalCloseButton").addEventListener("click", () => showScreen("map"));
$("#zoomInButton").addEventListener("click", () => setMapView(state.mapView.scale + .35));
$("#zoomOutButton").addEventListener("click", () => setMapView(state.mapView.scale - .35));
$("#resetViewButton").addEventListener("click", resetMapView);

scratchArea.addEventListener("pointerdown", (event) => { scratchState = { active: true, pointerId: event.pointerId, lastPoint: null }; scratchArea.setPointerCapture(event.pointerId); updateScratch(event); });
scratchArea.addEventListener("pointermove", updateScratch);
scratchArea.addEventListener("pointerup", stopScratch);
scratchArea.addEventListener("pointercancel", stopScratch);
scratchArea.addEventListener("lostpointercapture", stopScratch);

mapStage.addEventListener("pointerdown", (event) => {
  if (state.mapView.scale <= 1 || event.target.closest("button")) return;
  draggingMap = true;
  mapDragStart = { clientX: event.clientX, clientY: event.clientY, x: state.mapView.x, y: state.mapView.y };
  mapTransform.classList.add("is-dragging");
  mapStage.setPointerCapture(event.pointerId);
});
mapStage.addEventListener("pointermove", (event) => {
  if (!draggingMap) return;
  state.mapView.x = mapDragStart.x + event.clientX - mapDragStart.clientX;
  state.mapView.y = mapDragStart.y + event.clientY - mapDragStart.clientY;
  applyMapTransform();
});
mapStage.addEventListener("pointerup", () => { draggingMap = false; mapTransform.classList.remove("is-dragging"); });

document.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
  state.category = button.dataset.category;
  document.querySelectorAll("[data-category]").forEach((item) => item.classList.toggle("active", item === button));
  render();
}));

$("#addTextButton").addEventListener("click", () => {
  const text = prompt("写下这一刻：", "今天在央美遇见了……");
  if (text?.trim()) addJournalItem({ type: "text", text: text.trim() });
});
$("#addStickerButton").addEventListener("click", () => {
  state.journalDrawer = "stickers";
  renderJournalDrawer();
});
$("#addPlaceButton").addEventListener("click", () => {
  state.journalDrawer = "places";
  renderJournalDrawer();
});
$("#closeJournalDrawer").addEventListener("click", () => { state.journalDrawer = null; renderJournalDrawer(); });
$("#photoInput").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => addJournalItem({ type: "photo", src: reader.result });
  reader.readAsDataURL(file);
  event.target.value = "";
});
$("#exportJournalButton").addEventListener("click", exportJournal);
$("#editItemButton").addEventListener("click", () => {
  const item = state.journal.items.find((entry) => entry.id === state.selectedJournalId);
  if (!item || item.type !== "text") return showToast("请先点选一段文字");
  const text = prompt("修改文字：", item.text);
  if (text?.trim()) mutateSelected((entry) => entry.text = text.trim());
});
$("#rotateLeftButton").addEventListener("click", () => mutateSelected((item) => item.rotation -= 8));
$("#rotateRightButton").addEventListener("click", () => mutateSelected((item) => item.rotation += 8));
$("#shrinkItemButton").addEventListener("click", () => mutateSelected((item) => item.scale = Math.max(.45, item.scale - .12)));
$("#growItemButton").addEventListener("click", () => mutateSelected((item) => item.scale = Math.min(2.2, item.scale + .12)));
$("#sendBackButton").addEventListener("click", () => mutateSelected((item) => item.z = Math.max(1, item.z - 1)));
$("#bringFrontButton").addEventListener("click", () => mutateSelected((item) => item.z = Math.max(...state.journal.items.map((entry) => entry.z), 0) + 1));
$("#deleteItemButton").addEventListener("click", () => { state.journal.items = state.journal.items.filter((item) => item.id !== state.selectedJournalId); state.selectedJournalId = null; persistJournal(); renderJournal(); });
$("#clearJournalButton").addEventListener("click", () => { if (confirm("清空当前手账并重新开始？")) { state.journal = { version: 2, items: [] }; state.journalCleared = true; localStorage.setItem("yuditu:journal:cleared", "true"); state.selectedJournalId = null; persistJournal(); renderJournal(); } });
journalCanvas.addEventListener("pointermove", moveJournalItem);
journalCanvas.addEventListener("pointerup", endJournalDrag);
journalCanvas.addEventListener("pointerdown", (event) => { if (event.target === journalCanvas) { state.selectedJournalId = null; renderJournal(); } });

render();

const preview = new URLSearchParams(location.search).get("preview");
if (preview === "map" || preview === "route") {
  hero.classList.add("is-hidden"); mapScreen.classList.remove("is-hidden"); bottomNav.classList.remove("is-hidden");
  state.unlocked = preview === "route" ? regions.map((region) => region.id) : ["east"];
  if (preview === "route") { const route = buildRoute(places, parseGoal($("#goalInput").value), { unlocked: state.unlocked }); state.routeStops = route.stops.map((place) => place.id); state.routeReasons = route.stopReasons; }
  render();
  if (preview === "route") requestAnimationFrame(focusRoute);
}
if (preview === "journal") { hero.classList.add("is-hidden"); bottomNav.classList.remove("is-hidden"); state.unlocked = ["east", "west"]; showScreen("journal"); render(); }
if (preview === "unlock") { hero.classList.add("is-hidden"); mapScreen.classList.remove("is-hidden"); bottomNav.classList.remove("is-hidden"); render(); openUnlock("east"); }
