export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type VisibleTooltipItem = {
  index: number;
  order: number;
  inLimit: boolean;
};

export type VisibleTooltipSelection = {
  items: VisibleTooltipItem[];
  minDistance: number;
  maxDistance: number;
};

export function getValueRanks(values: number[]): number[] {
  const count = values.length;
  const order = new Array<number>(count);
  for (let i = 0; i < count; i += 1) order[i] = i;
  order.sort((a, b) => values[b] - values[a] || a - b);

  const ranks = new Array<number>(count);
  for (let i = 0; i < count; i += 1) {
    const index = order[i];
    ranks[index] =
      i > 0 && values[index] === values[order[i - 1]]
        ? ranks[order[i - 1]]
        : i + 1;
  }
  return ranks;
}

export function selectVisibleTooltipIndices(
  distances: ArrayLike<number>,
  limit: number,
  extraIndices: ReadonlyArray<number | null | undefined> = []
): VisibleTooltipSelection {
  const count = distances.length;
  const order = new Array<number>(count);
  for (let i = 0; i < count; i += 1) order[i] = i;
  order.sort((a, b) => distances[a] - distances[b]);

  const cappedLimit = Math.max(0, Math.min(limit, count));
  const selected = new Map<number, VisibleTooltipItem>();
  let minDistance = Infinity;
  let maxDistance = -Infinity;

  for (let i = 0; i < cappedLimit; i += 1) {
    const index = order[i];
    const distance = distances[index];
    selected.set(index, { index, order: i, inLimit: true });
    if (distance < minDistance) minDistance = distance;
    if (distance > maxDistance) maxDistance = distance;
  }

  extraIndices.forEach((index) => {
    if (index === null || index === undefined) return;
    if (index < 0 || index >= count || selected.has(index)) return;
    selected.set(index, { index, order: -1, inLimit: false });
  });

  return {
    items: [...selected.values()],
    minDistance: Number.isFinite(minDistance) ? minDistance : 0,
    maxDistance: Number.isFinite(maxDistance) ? maxDistance : 0,
  };
}

export function isPointOccludedBySphere(
  point: Vec3,
  camera: Vec3,
  radius: number
): boolean {
  if (radius <= 0) return false;

  const dx = point.x - camera.x;
  const dy = point.y - camera.y;
  const dz = point.z - camera.z;
  const segmentLengthSq = dx * dx + dy * dy + dz * dz;
  if (segmentLengthSq < 1e-12) return false;

  const cameraLengthSq =
    camera.x * camera.x + camera.y * camera.y + camera.z * camera.z;
  const radiusSq = radius * radius;
  if (cameraLengthSq <= radiusSq) return false;

  const t = -(camera.x * dx + camera.y * dy + camera.z * dz) / segmentLengthSq;
  if (t <= 1e-6 || t >= 1 - 1e-6) return false;

  const closestX = camera.x + t * dx;
  const closestY = camera.y + t * dy;
  const closestZ = camera.z + t * dz;
  return (
    closestX * closestX + closestY * closestY + closestZ * closestZ < radiusSq
  );
}
