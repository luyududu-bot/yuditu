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

export function buildRoute(places, goal) {
  const wanted = [...goal.interests, ...goal.needs];
  const ranked = [...places].sort((a, b) => {
    const score = (place) =>
      wanted.filter((tag) => place.tags.includes(tag)).length * 10 +
      (place.metadata.representativeScore || 0);
    return score(b) - score(a);
  });

  const stops = [];
  let estimatedMinutes = 0;
  for (const place of ranked) {
    const visitMinutes = place.metadata.visitMinutes || 5;
    if (estimatedMinutes + visitMinutes > goal.timeBudgetMinutes) continue;
    stops.push(place);
    estimatedMinutes += visitMinutes;
    if (stops.length === 4) break;
  }

  return {
    stops,
    estimatedMinutes,
    reason: `根据你的目标，在 ${goal.timeBudgetMinutes} 分钟内优先串联代表性与需求匹配度最高的地点。`,
  };
}

export function applyUnlock(unlocked, regionId) {
  return unlocked.includes(regionId) ? [...unlocked] : [...unlocked, regionId];
}

export function progressFor(unlocked) {
  return Math.round((new Set(unlocked).size / 4) * 100);
}
