import { applyUnlock, buildRoute, parseGoal, progressFor } from "./core.mjs";
import { places, regions } from "./data.mjs";

const $ = (selector) => document.querySelector(selector);
const state = {
  unlocked: JSON.parse(localStorage.getItem("yuditu:unlocked") || "[]"),
  activeRegion: null,
  category: "全部",
  routeStops: [],
};

const hero = $("#hero");
const mapScreen = $("#mapScreen");
const journalScreen = $("#journalScreen");
const bottomNav = $("#bottomNav");
const regionLayer = $("#regionLayer");
const revealLayer = $("#revealLayer");
const markerLayer = $("#markerLayer");
const unlockDialog = $("#unlockDialog");
const detailDialog = $("#detailDialog");
const scratchArea = $("#scratchArea");
let scratching = false;
let scratchValue = 0;
let lastPoint = null;

function iconClassFor(category) {
  return {
    展览: "icon-exhibition",
    服务: "icon-service",
    补给: "icon-supply",
    打卡: "icon-checkin",
    出入口: "icon-entrance",
  }[category] || "icon-service";
}

function persist() {
  localStorage.setItem("yuditu:unlocked", JSON.stringify(state.unlocked));
}

function render() {
  const progress = progressFor(state.unlocked);
  $("#progressText").textContent = `${progress}%`;
  $("#progressBar").style.width = `${progress}%`;
  $("#mapHint").textContent = progress === 100 ? "校园已完整显影，可以自由探索每一处故事" : "选择一片区域，用扫帚唤醒它";

  revealLayer.innerHTML = state.unlocked.length === regions.length
    ? `<div class="region-reveal complete-reveal" data-reveal="complete"></div>`
    : regions
      .filter((region) => state.unlocked.includes(region.id))
      .map((region) => `<div class="region-reveal" data-reveal="${region.id}" style="clip-path:polygon(${region.polygon})"></div>`)
      .join("");

  regionLayer.innerHTML = regions.map((region) => `
    <button class="region-chip ${state.unlocked.includes(region.id) ? "unlocked" : ""}"
      data-region="${region.id}" style="left:${region.x}%;top:${region.y}%">
      ${state.unlocked.includes(region.id) ? "✓ " : ""}${region.name}
    </button>`).join("");

  markerLayer.innerHTML = places.map((place) => {
    const visible = state.unlocked.includes(place.regionId) &&
      (state.category === "全部" || state.category === place.category);
    const routeStop = state.routeStops.includes(place.id);
    const numberBadge = /^\d+$/.test(place.number || "") ? `<i class="marker-number">${place.number}</i>` : "";
    const markerContent = place.type === "place"
      ? `<span class="building-number">${place.number}</span>`
      : `<span class="category-icon ${iconClassFor(place.category)}" aria-hidden="true"></span>${numberBadge}`;
    return `<button class="marker ${place.type === "place" ? "building-marker" : "asset-marker"} ${visible ? "visible" : ""} ${routeStop ? "route-stop" : ""}"
      data-place="${place.id}" style="left:${place.x}%;top:${place.y}%"
      aria-label="${place.name}">${markerContent}</button>`;
  }).join("");

  regionLayer.querySelectorAll("[data-region]").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.region;
    if (state.unlocked.includes(id)) {
      showToast(`${regions.find((region) => region.id === id).name}已经显影`);
      return;
    }
    openUnlock(id);
  }));
  markerLayer.querySelectorAll("[data-place]").forEach((button) => button.addEventListener("click", () => openDetail(button.dataset.place)));
  renderJournal();
}

function openUnlock(regionId) {
  state.activeRegion = regionId;
  scratchValue = 0;
  lastPoint = null;
  $("#scratchSand").style.opacity = "1";
  $("#scratchBar").style.width = "0";
  $("#scratchText").textContent = "显影 0%";
  $("#unlockTitle").textContent = `唤醒${regions.find((region) => region.id === regionId).name}`;
  unlockDialog.showModal();
}

function updateScratch(event) {
  if (!scratching || !state.activeRegion) return;
  const rect = scratchArea.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
  $("#brushCursor").style.left = `${x}px`;
  $("#brushCursor").style.top = `${y}px`;
  if (lastPoint) scratchValue += Math.hypot(x - lastPoint.x, y - lastPoint.y) / 9;
  lastPoint = { x, y };
  const percent = Math.min(100, Math.round(scratchValue));
  $("#scratchSand").style.opacity = String(1 - percent / 105);
  $("#scratchBar").style.width = `${percent}%`;
  $("#scratchText").textContent = `显影 ${percent}%`;
  if (percent >= 60) finishUnlock();
}

function finishUnlock() {
  scratching = false;
  state.unlocked = applyUnlock(state.unlocked, state.activeRegion);
  const region = regions.find((item) => item.id === state.activeRegion);
  persist();
  unlockDialog.close();
  state.activeRegion = null;
  render();
  showToast(`${region.name}显影完成，新的地点故事已出现`);
  if (progressFor(state.unlocked) === 100) setTimeout(() => showToast("四片校园之屿已连接，完整图鉴正在等你探索"), 1200);
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

function renderJournal() {
  const discovered = places.filter((place) => state.unlocked.includes(place.regionId));
  $("#journalProgress").textContent = `已显影 ${state.unlocked.length} / 4 片校园之屿 · 发现 ${discovered.length} 个地点`;
  $("#journalPlaceList").innerHTML = discovered.length
    ? discovered.slice(0, 8).map((place) => `<button data-place="${place.id}"><b>${place.number}</b><span>${place.name}<small>${place.category}</small></span></button>`).join("")
    : `<p class="journal-empty">先去地图显影一片区域，这里会收进你发现的地点。</p>`;
  $("#journalPlaceList").querySelectorAll("[data-place]").forEach((button) => button.addEventListener("click", () => openDetail(button.dataset.place)));
}

$("#enterButton").addEventListener("click", () => {
  hero.classList.add("is-hidden");
  mapScreen.classList.remove("is-hidden");
  bottomNav.classList.remove("is-hidden");
  render();
});
$("#heroJournalButton").addEventListener("click", () => {
  hero.classList.add("is-hidden");
  bottomNav.classList.remove("is-hidden");
  showScreen("journal");
  render();
});
$("#goalToggle").addEventListener("click", () => $("#goalForm").classList.toggle("is-hidden"));
$("#goalForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const goal = parseGoal($("#goalInput").value);
  const route = buildRoute(places, goal);
  state.routeStops = route.stops.map((place) => place.id);
  const result = $("#routeResult");
  result.innerHTML = `<strong>${route.estimatedMinutes} 分钟 · ${route.stops.map((stop) => stop.name).join(" → ")}</strong>${route.reason}`;
  result.classList.remove("is-hidden");
  render();
});
$("#resetButton").addEventListener("click", () => {
  if (!confirm("重新覆盖校园尘沙并清除显影进度？")) return;
  state.unlocked = [];
  state.routeStops = [];
  persist();
  render();
});
$("#closeUnlock").addEventListener("click", () => unlockDialog.close());
$("#closeDetail").addEventListener("click", () => detailDialog.close());
$("#mapButton").addEventListener("click", () => showScreen("map"));
$("#journalButton").addEventListener("click", () => showScreen("journal"));
$("#journalCloseButton").addEventListener("click", () => showScreen("map"));
$("#createJournalButton").addEventListener("click", () => showToast("今日手账已创建，继续探索即可自动收集地点"));
scratchArea.addEventListener("pointerdown", (event) => { scratching = true; lastPoint = null; scratchArea.setPointerCapture(event.pointerId); updateScratch(event); });
scratchArea.addEventListener("pointermove", updateScratch);
scratchArea.addEventListener("pointerup", () => { scratching = false; lastPoint = null; });
document.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
  state.category = button.dataset.category;
  document.querySelectorAll("[data-category]").forEach((item) => item.classList.toggle("active", item === button));
  render();
}));

render();

const preview = new URLSearchParams(location.search).get("preview");
if (preview === "map" || preview === "route") {
  hero.classList.add("is-hidden");
  mapScreen.classList.remove("is-hidden");
  bottomNav.classList.remove("is-hidden");
  state.unlocked = preview === "route" ? regions.map((region) => region.id) : ["east"];
  if (preview === "route") {
    const route = buildRoute(places, parseGoal($("#goalInput").value));
    state.routeStops = route.stops.map((place) => place.id);
    $("#routeResult").innerHTML = `<strong>${route.estimatedMinutes} 分钟 · ${route.stops.map((stop) => stop.name).join(" → ")}</strong>${route.reason}`;
    $("#routeResult").classList.remove("is-hidden");
  }
  render();
}
if (preview === "journal") {
  hero.classList.add("is-hidden");
  bottomNav.classList.remove("is-hidden");
  state.unlocked = ["east", "west"];
  showScreen("journal");
  render();
}
if (preview === "unlock") {
  hero.classList.add("is-hidden");
  mapScreen.classList.remove("is-hidden");
  bottomNav.classList.remove("is-hidden");
  render();
  openUnlock("east");
}
