const defaults = { rotation: 0, scale: 1, z: 1 };

export function sortJournalItems(items) {
  return [...items].sort((a, b) => a.z - b.z);
}

export function migrateJournal(value) {
  if (value?.version === 2 && Array.isArray(value.items)) return value;
  const items = Array.isArray(value) ? value : [];
  return {
    version: 2,
    items: items.map((item, index) => ({
      ...defaults,
      z: index + 1,
      ...item,
      type: item.type === "sticker" && !item.src ? "label" : item.type,
    })),
  };
}

export function createJournalItem(type, properties = {}, index = 0) {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    type,
    x: 50,
    y: 50,
    ...defaults,
    z: index + 1,
    ...properties,
  };
}

export function createAutoJournal(places, unlocked, date = new Date().toISOString().slice(0, 10)) {
  const discovered = places
    .filter((place) => unlocked.includes(place.regionId))
    .sort((a, b) => (b.metadata.representativeScore || 0) - (a.metadata.representativeScore || 0))
    .slice(0, 3);
  const items = [
    createJournalItem("label", { text: date.slice(5).replace("-", "月") + "日", x: 25, y: 10, rotation: -3 }, 0),
    createJournalItem("text", { text: discovered.length ? "今日校园漫游" : "等待第一次校园发现", x: 48, y: 20, scale: 1.15 }, 1),
    createJournalItem("text", { text: discovered.length ? `今天显影了 ${new Set(discovered.map((place) => place.regionId)).size} 片校园之屿，收藏这些遇见。` : "先去地图扫开一片尘沙，发现的地点会来到这里。", x: 50, y: 34, scale: .72 }, 2),
    ...discovered.map((place, index) => createJournalItem("place", {
      placeId: place.id, name: place.name, number: place.number, category: place.category,
      x: index % 2 ? 69 : 30, y: 52 + index * 14, rotation: index % 2 ? 4 : -3,
    }, index + 3)),
  ];
  return { version: 2, items };
}
