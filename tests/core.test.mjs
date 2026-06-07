import test from "node:test";
import assert from "node:assert/strict";
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
