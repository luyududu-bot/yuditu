export const supportedActions = new Set([
  "view_detail",
  "open_detail",
  "focus_on_object",
  "add_to_route",
  "create_journal",
  "set_as_start",
]);

const actionAliases = { view_detail: "open_detail" };

export function listObjects(objects, filters = {}, context = {}) {
  return objects.filter((object) => {
    if (context.unlocked && !context.unlocked.includes(object.regionId)) return false;
    if (filters.category && object.category !== filters.category) return false;
    if (filters.type && object.type !== filters.type) return false;
    if (filters.tags?.length && !filters.tags.every((tag) => object.tags?.includes(tag))) return false;
    return true;
  });
}

export function getObject(objects, objectId) {
  return objects.find((object) => object.id === objectId) || null;
}

export function getAvailableActions(object, context = {}) {
  if (!object) return [];
  if (object.constraints?.requiresRegionUnlocked && !context.unlocked?.includes(object.regionId)) return [];
  const actions = (object.actions || []).map((action) => actionAliases[action] || action);
  if (actions.includes("open_detail") && !actions.includes("focus_on_object")) actions.push("focus_on_object");
  return [...new Set(actions)].filter((action) => supportedActions.has(action));
}

export function executeAction(actionId, object, context = {}) {
  const available = getAvailableActions(object, context);
  if (!available.includes(actionId)) return { ok: false, reason: "action-unavailable" };
  const adapter = context.adapters?.[actionId];
  if (typeof adapter !== "function") return { ok: false, reason: "adapter-missing" };
  return { ok: true, value: adapter(object) };
}

export function validateObjectData(regions, objects) {
  const errors = [];
  const regionIds = new Set(regions.map((region) => region.id));
  const objectIds = new Set();
  for (const object of objects) {
    if (objectIds.has(object.id)) errors.push({ code: "duplicate-id", objectId: object.id });
    objectIds.add(object.id);
  }
  for (const object of objects) {
    if (!regionIds.has(object.regionId)) errors.push({ code: "invalid-region", objectId: object.id, value: object.regionId });
    for (const action of object.actions || []) {
      if (!supportedActions.has(action)) errors.push({ code: "unknown-action", objectId: object.id, value: action });
    }
    for (const values of Object.values(object.relations || {})) {
      for (const relationId of Array.isArray(values) ? values : [values]) {
        if (!objectIds.has(relationId) && !regionIds.has(relationId) && relationId !== "outside") {
          errors.push({ code: "dangling-relation", objectId: object.id, value: relationId });
        }
      }
    }
    const score = object.metadata?.representativeScore;
    const minutes = object.metadata?.visitMinutes;
    if (!(score >= 0 && score <= 1) || !(minutes > 0)) {
      errors.push({ code: "invalid-route-metadata", objectId: object.id });
    }
  }
  return errors;
}
