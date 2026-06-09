export function parseGoal(input = "") {
  const timeMatch = input.match(/(\d+)\s*分钟/);
  const interests = [];
  const needs = [];

  if (/第一次|初次|代表/.test(input)) interests.push("第一次来");
  if (/代表|经典|必看/.test(input)) interests.push("代表性");
  if (/展|美术馆/.test(input)) interests.push("看展");
  if (/拍照|打卡/.test(input)) interests.push("打卡");
  if (/吃|食堂|补给/.test(input)) needs.push("补给");
  if (/充电/.test(input)) needs.push("充电");

  return {
    timeBudgetMinutes: timeMatch ? Number(timeMatch[1]) : 30,
    interests: [...new Set(interests)],
    needs: [...new Set(needs)],
  };
}

function matchScore(place, wanted) {
  return wanted.filter((tag) => place.tags.includes(tag)).length * 10 +
    (place.metadata.representativeScore || 0);
}

function distanceBetween(a, b) {
  return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
}

function explainStop(place, wanted, previous) {
  const matches = wanted.filter((tag) => place.tags.includes(tag));
  if (matches.length) return `匹配你的${matches.join("、")}目标${previous ? "，并与上一站顺路" : ""}。`;
  if ((place.metadata.representativeScore || 0) >= .7) return `代表性较高${previous ? "，且适合接续上一站" : ""}。`;
  return previous ? "适合顺路补充这段校园体验。" : "适合作为本次探索的起点。";
}

export function buildRoute(places, goal, context = {}) {
  const wanted = [...goal.interests, ...goal.needs];
  const candidates = context.unlocked
    ? places.filter((place) => context.unlocked.includes(place.regionId))
    : [...places];
  const remaining = [...candidates];

  const stops = [];
  const stopReasons = [];
  let estimatedMinutes = 0;
  while (remaining.length && stops.length < 4) {
    const previous = stops.at(-1);
    remaining.sort((a, b) => {
      const distancePenalty = (place) => previous ? distanceBetween(previous, place) * .08 : 0;
      return (matchScore(b, wanted) - distancePenalty(b)) - (matchScore(a, wanted) - distancePenalty(a));
    });
    const place = remaining.shift();
    const visitMinutes = place.metadata.visitMinutes || 5;
    if (estimatedMinutes + visitMinutes > goal.timeBudgetMinutes) continue;
    stops.push(place);
    stopReasons.push({ placeId: place.id, reason: explainStop(place, wanted, previous) });
    estimatedMinutes += visitMinutes;
  }

  return {
    stops,
    stopReasons,
    estimatedMinutes,
    reason: stops.length
      ? `根据你的目标，在 ${goal.timeBudgetMinutes} 分钟内优先串联已显影、匹配且顺路的地点。`
      : "当前没有可规划的已显影地点，请先显影一片校园。",
  };
}

export function applyUnlock(unlocked, regionId) {
  return unlocked.includes(regionId) ? [...unlocked] : [...unlocked, regionId];
}

export function progressFor(unlocked) {
  return Math.round((new Set(unlocked).size / 4) * 100);
}
