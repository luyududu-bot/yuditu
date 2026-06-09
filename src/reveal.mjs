export function createScratchState() {
  return { active: false, pointerId: null, lastPoint: null };
}

export function endScratch() {
  return createScratchState();
}

export function interpolateStroke(from, to, spacing = 10) {
  if (!from) return [to];
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / spacing));
  return Array.from({ length: steps + 1 }, (_, index) => ({
    x: from.x + (to.x - from.x) * index / steps,
    y: from.y + (to.y - from.y) * index / steps,
  }));
}

export function spawnSandParticles(current, point, previous, options = {}) {
  const random = options.random || Math.random;
  const count = options.count ?? Math.max(3, Math.round(Math.hypot(point.x - previous.x, point.y - previous.y) / 3));
  const max = options.max ?? 110;
  const dx = point.x - previous.x;
  const dy = point.y - previous.y;
  const angle = Math.atan2(dy, dx) + Math.PI;
  const created = Array.from({ length: count }, () => {
    const spread = (random() - .5) * 1.8;
    const speed = 25 + random() * 60;
    return {
      x: point.x + (random() - .5) * 14,
      y: point.y + (random() - .5) * 14,
      vx: Math.cos(angle + spread) * speed,
      vy: Math.sin(angle + spread) * speed - random() * 20,
      radius: 1.5 + random() * 4,
      age: 0,
      life: 360 + random() * 520,
      rotation: random() * Math.PI,
      spin: (random() - .5) * .012,
    };
  });
  return [...current, ...created].slice(-max);
}

export function advanceSandParticles(particles, elapsed) {
  return particles.flatMap((particle) => {
    const age = particle.age + elapsed;
    if (age >= particle.life) return [];
    const seconds = elapsed / 1000;
    return [{ ...particle, age, x: particle.x + particle.vx * seconds, y: particle.y + particle.vy * seconds, vy: particle.vy + 55 * seconds, rotation: particle.rotation + particle.spin * elapsed }];
  });
}

export function insetPolygon(polygon, scale = .88) {
  const points = polygon.split(",").map((pair) => pair.trim().split(/\s+/).map((value) => Number.parseFloat(value)));
  const center = points.reduce((result, point) => ({ x: result.x + point[0] / points.length, y: result.y + point[1] / points.length }), { x: 0, y: 0 });
  const format = (value) => Number(value.toFixed(2));
  return points.map(([x, y]) => `${format(center.x + (x - center.x) * scale)}% ${format(center.y + (y - center.y) * scale)}%`).join(", ");
}
