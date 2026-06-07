import { applyUnlock, buildRoute, parseGoal, progressFor } from "./core.mjs";
import { places, regions } from "./data.mjs";

const $ = (selector) => document.querySelector(selector);
const state = {
  unlocked: JSON.parse(localStorage.getItem("yuditu:unlocked") || "[]"),
  activeRegion: null,
  category: "全部",
  routeStops: [],
  mapView: { scale: 1, x: 0, y: 0 },
  journal: JSON.parse(localStorage.getItem("yuditu:journal") || "[]"),
  selectedJournalId: null,
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
const journalCanvas = $("#journalCanvas");
let scratching = false;
let lastScratchPoint = null;
let scratchChecks = 0;
let draggingMap = false;
let mapDragStart = null;
let journalDrag = null;

function iconClassFor(category) {
  return { 展览: "icon-exhibition", 服务: "icon-service", 补给: "icon-supply", 打卡: "icon-checkin", 出入口: "icon-entrance" }[category] || "icon-service";
}

function persist() {
  localStorage.setItem("yuditu:unlocked", JSON.stringify(state.unlocked));
}

function persistJournal() {
  try {
    localStorage.setItem("yuditu:journal", JSON.stringify(state.journal));
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
      `<div class="region-reveal" data-reveal="${region.id}" style="--rx:${region.x}%;--ry:${region.y}%"></div>`
    ).join("");

  regionLayer.innerHTML = regions.map((region) => `
    <button class="region-chip ${state.unlocked.includes(region.id) ? "unlocked" : ""}"
      data-region="${region.id}" style="left:${region.x}%;top:${region.y}%">
      ${state.unlocked.includes(region.id) ? "✓ " : ""}${region.name}
    </button>`).join("");

  markerLayer.innerHTML = places.map((place) => {
    const visible = state.unlocked.includes(place.regionId) && (state.category === "全部" || state.category === place.category);
    const routeStop = state.routeStops.includes(place.id);
    const numberBadge = /^\d+$/.test(place.number || "") ? `<i class="marker-number">${place.number}</i>` : "";
    const markerContent = place.type === "place"
      ? `<span class="building-number">${place.number}</span>`
      : `<span class="category-icon ${iconClassFor(place.category)}" aria-hidden="true"></span>${numberBadge}`;
    return `<button class="marker ${place.type === "place" ? "building-marker" : "asset-marker"} ${visible ? "visible" : ""} ${routeStop ? "route-stop" : ""}"
      data-place="${place.id}" style="left:${place.x}%;top:${place.y}%" aria-label="${place.name}">${markerContent}</button>`;
  }).join("");

  regionLayer.querySelectorAll("[data-region]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.region;
    state.unlocked.includes(id) ? focusRegion(id) : openUnlock(id);
  }));
  markerLayer.querySelectorAll("[data-place]").forEach((button) => button.addEventListener("click", () => openDetail(button.dataset.place)));
  renderJournal();
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
  lastScratchPoint = null;
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
  scratchContext.save();
  scratchContext.globalCompositeOperation = "destination-out";
  scratchContext.lineCap = "round";
  scratchContext.lineJoin = "round";
  scratchContext.lineWidth = 54 * sx;
  scratchContext.beginPath();
  scratchContext.moveTo((previous?.x ?? x) * sx, (previous?.y ?? y) * sy);
  scratchContext.lineTo(x * sx, y * sy);
  scratchContext.stroke();
  scratchContext.restore();
}

function erasedPercent() {
  const data = scratchContext.getImageData(0, 0, scratchCanvas.width, scratchCanvas.height).data;
  let cleared = 0;
  const step = 64;
  for (let i = 3; i < data.length; i += step) if (data[i] < 40) cleared++;
  return Math.min(100, Math.round(cleared / (data.length / step) * 100));
}

function updateScratch(event) {
  if (!scratching || !state.activeRegion) return;
  const rect = scratchArea.getBoundingClientRect();
  const point = { x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)) };
  $("#brushCursor").style.left = `${point.x}px`;
  $("#brushCursor").style.top = `${point.y}px`;
  eraseScratch(point.x, point.y, lastScratchPoint);
  lastScratchPoint = point;
  if (++scratchChecks % 4 !== 0) return;
  const percent = erasedPercent();
  $("#scratchBar").style.width = `${percent}%`;
  $("#scratchText").textContent = `显影 ${percent}%`;
  if (percent >= 60) finishUnlock();
}

function finishUnlock() {
  scratching = false;
  const region = regions.find((item) => item.id === state.activeRegion);
  state.unlocked = applyUnlock(state.unlocked, state.activeRegion);
  persist();
  unlockDialog.close();
  state.activeRegion = null;
  render();
  requestAnimationFrame(() => focusRegion(region.id));
  showToast(`${region.name}显影完成，已为你放大这片校园`);
}

function openDetail(id) {
  const place = places.find((item) => item.id === id);
  $("#detailCategory").textContent = place.category;
  $("#detailName").textContent = place.name;
  $("#detailDescription").textContent = place.metadata.description;
  $("#detailTags").innerHTML = [...place.tags, ...place.metadata.facilities].map((tag) => `<span>${tag}</span>`).join("");
  $("#detailObject").textContent = `${place.type} · actions: ${place.actions.join(", ")}`;
  detailDialog.showModal();
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
  const offset = state.journal.length % 6;
  state.journal.push({ id: uid(), x: 28 + offset * 8, y: 25 + offset * 9, rotation: (offset - 2) * 3, scale: 1, z: state.journal.length + 1, ...item });
  state.selectedJournalId = state.journal.at(-1).id;
  persistJournal();
  renderJournal();
}

function defaultJournal() {
  if (state.journal.length) return;
  state.journal = [
    { id: uid(), type: "text", text: "今日校园漫游", x: 50, y: 11, rotation: -2, scale: 1.15, z: 1 },
    { id: uid(), type: "sticker", text: "✦", x: 82, y: 19, rotation: 8, scale: .85, z: 2 },
    { id: uid(), type: "text", text: "把遇见的故事贴在这里", x: 50, y: 87, rotation: 1, scale: .8, z: 3 },
  ];
  persistJournal();
}

function renderJournal() {
  defaultJournal();
  const discovered = places.filter((place) => state.unlocked.includes(place.regionId));
  $("#journalProgress").textContent = `已显影 ${state.unlocked.length} / 4 片校园之屿 · 发现 ${discovered.length} 个地点。拖动素材自由排版，点选后可缩放与旋转。`;
  journalCanvas.innerHTML = state.journal.sort((a, b) => a.z - b.z).map((item) => {
    const style = `left:${item.x}%;top:${item.y}%;--rotation:${item.rotation}deg;--scale:${item.scale};z-index:${item.z}`;
    const selected = item.id === state.selectedJournalId ? "selected" : "";
    if (item.type === "photo") return `<div class="journal-item photo ${selected}" data-journal-id="${item.id}" style="${style}"><img src="${item.src}" alt="用户上传照片" /></div>`;
    if (item.type === "place") return `<div class="journal-item place ${selected}" data-journal-id="${item.id}" style="${style}"><b>${item.number}</b><span>${item.name}<small>${item.category}</small></span></div>`;
    return `<div class="journal-item ${item.type} ${selected}" data-journal-id="${item.id}" style="${style}">${item.text}</div>`;
  }).join("");
  journalCanvas.querySelectorAll("[data-journal-id]").forEach((element) => element.addEventListener("pointerdown", startJournalDrag));
  $("#journalPlaceList").innerHTML = discovered.length
    ? discovered.map((place) => `<button data-add-place="${place.id}"><b>${place.number}</b><span>${place.name}<small>${place.category}</small></span></button>`).join("")
    : `<p class="journal-empty">先去地图显影区域，发现的地点会成为手账素材。</p>`;
  $("#journalPlaceList").querySelectorAll("[data-add-place]").forEach((button) => button.addEventListener("click", () => addPlaceToJournal(button.dataset.addPlace)));
}

function startJournalDrag(event) {
  event.preventDefault();
  const id = event.currentTarget.dataset.journalId;
  state.selectedJournalId = id;
  const item = state.journal.find((entry) => entry.id === id);
  journalDrag = { id, startX: event.clientX, startY: event.clientY, x: item.x, y: item.y };
  event.currentTarget.setPointerCapture(event.pointerId);
  journalCanvas.querySelectorAll(".journal-item").forEach((element) => element.classList.toggle("selected", element.dataset.journalId === id));
}

function moveJournalItem(event) {
  if (!journalDrag) return;
  const rect = journalCanvas.getBoundingClientRect();
  const item = state.journal.find((entry) => entry.id === journalDrag.id);
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
  const item = state.journal.find((entry) => entry.id === state.selectedJournalId);
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
  for (const item of [...state.journal].sort((a, b) => a.z - b.z)) {
    context.save();
    context.translate(item.x / 100 * output.width, item.y / 100 * output.height);
    context.rotate(item.rotation * Math.PI / 180);
    context.scale(item.scale, item.scale);
    if (item.type === "photo") {
      roundedRect(context, -160, -135, 320, 300, 5, "#fffdf8");
      const image = await loadImage(item.src);
      context.drawImage(image, -145, -120, 290, 230);
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
  const route = buildRoute(places, parseGoal($("#goalInput").value));
  state.routeStops = route.stops.map((place) => place.id);
  $("#routeResult").innerHTML = `<strong>${route.estimatedMinutes} 分钟 · ${route.stops.map((stop) => stop.name).join(" → ")}</strong>${route.reason}`;
  $("#routeResult").classList.remove("is-hidden");
  render();
});
$("#resetButton").addEventListener("click", () => { if (confirm("重新覆盖校园尘沙并清除显影进度？")) { state.unlocked = []; state.routeStops = []; persist(); resetMapView(); render(); } });
$("#closeUnlock").addEventListener("click", () => unlockDialog.close());
$("#closeDetail").addEventListener("click", () => detailDialog.close());
$("#mapButton").addEventListener("click", () => showScreen("map"));
$("#journalButton").addEventListener("click", () => showScreen("journal"));
$("#journalCloseButton").addEventListener("click", () => showScreen("map"));
$("#zoomInButton").addEventListener("click", () => setMapView(state.mapView.scale + .35));
$("#zoomOutButton").addEventListener("click", () => setMapView(state.mapView.scale - .35));
$("#resetViewButton").addEventListener("click", resetMapView);

scratchArea.addEventListener("pointerdown", (event) => { scratching = true; lastScratchPoint = null; scratchArea.setPointerCapture(event.pointerId); updateScratch(event); });
scratchArea.addEventListener("pointermove", updateScratch);
scratchArea.addEventListener("pointerup", () => { scratching = false; lastScratchPoint = null; });

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
  const stickers = ["✦", "♡", "☀", "✿", "⌖"];
  addJournalItem({ type: "sticker", text: stickers[state.journal.length % stickers.length] });
});
$("#addPlaceButton").addEventListener("click", () => {
  const place = places.find((entry) => state.unlocked.includes(entry.regionId));
  place ? addPlaceToJournal(place.id) : showToast("先显影一个区域，地点才能成为手账素材");
});
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
  const item = state.journal.find((entry) => entry.id === state.selectedJournalId);
  if (!item || item.type !== "text") return showToast("请先点选一段文字");
  const text = prompt("修改文字：", item.text);
  if (text?.trim()) mutateSelected((entry) => entry.text = text.trim());
});
$("#rotateLeftButton").addEventListener("click", () => mutateSelected((item) => item.rotation -= 8));
$("#rotateRightButton").addEventListener("click", () => mutateSelected((item) => item.rotation += 8));
$("#shrinkItemButton").addEventListener("click", () => mutateSelected((item) => item.scale = Math.max(.45, item.scale - .12)));
$("#growItemButton").addEventListener("click", () => mutateSelected((item) => item.scale = Math.min(2.2, item.scale + .12)));
$("#sendBackButton").addEventListener("click", () => mutateSelected((item) => item.z = Math.max(1, item.z - 1)));
$("#bringFrontButton").addEventListener("click", () => mutateSelected((item) => item.z = Math.max(...state.journal.map((entry) => entry.z), 0) + 1));
$("#deleteItemButton").addEventListener("click", () => { state.journal = state.journal.filter((item) => item.id !== state.selectedJournalId); state.selectedJournalId = null; persistJournal(); renderJournal(); });
$("#clearJournalButton").addEventListener("click", () => { if (confirm("清空当前手账并重新开始？")) { state.journal = []; state.selectedJournalId = null; persistJournal(); renderJournal(); } });
journalCanvas.addEventListener("pointermove", moveJournalItem);
journalCanvas.addEventListener("pointerup", endJournalDrag);

render();

const preview = new URLSearchParams(location.search).get("preview");
if (preview === "map" || preview === "route") {
  hero.classList.add("is-hidden"); mapScreen.classList.remove("is-hidden"); bottomNav.classList.remove("is-hidden");
  state.unlocked = preview === "route" ? regions.map((region) => region.id) : ["east"];
  if (preview === "route") { const route = buildRoute(places, parseGoal($("#goalInput").value)); state.routeStops = route.stops.map((place) => place.id); }
  render();
}
if (preview === "journal") { hero.classList.add("is-hidden"); bottomNav.classList.remove("is-hidden"); state.unlocked = ["east", "west"]; showScreen("journal"); render(); }
if (preview === "unlock") { hero.classList.add("is-hidden"); mapScreen.classList.remove("is-hidden"); bottomNav.classList.remove("is-hidden"); render(); openUnlock("east"); }
