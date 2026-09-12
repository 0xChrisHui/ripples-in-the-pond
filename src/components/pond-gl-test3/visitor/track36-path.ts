/** #36 的一次穿塘路径；深度是相对实时水面的 -30/+20/-10 层差。 */
export interface Track36Pose {
  x: number;
  y: number;
  depthOffset: number;
}

const DEPTH_KNOTS = [
  { at: 0, depthOffset: -0.3 },
  { at: 0.48, depthOffset: 0.2 },
  { at: 0.74, depthOffset: -0.1 },
  { at: 1, depthOffset: -0.1 },
] as const;

const PATH = [
  { x: -0.12, y: 0.10 },
  { x: 0.18, y: 0.04 },
  { x: 0.78, y: 0.55 },
  { x: 0.58, y: 1.12 },
] as const;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => value * value * (3 - 2 * value);
const mix = (a: number, b: number, amount: number): number => a + (b - a) * amount;

function cubic(a: number, b: number, c: number, d: number, t: number): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

function sampleDepth(p: number): number {
  const endIndex = DEPTH_KNOTS.findIndex((knot) => knot.at >= p);
  if (endIndex <= 0) return DEPTH_KNOTS[0].depthOffset;
  const end = DEPTH_KNOTS[endIndex];
  const start = DEPTH_KNOTS[endIndex - 1];
  return mix(start.depthOffset, end.depthOffset, smooth((p - start.at) / (end.at - start.at)));
}

/** 屏幕位置走单条 cubic Bézier；深度独立 smoothstep，转折不让球在空中急停。 */
export function sampleTrack36Path(progress: number): Track36Pose {
  const p = clamp01(progress);
  return {
    x: cubic(PATH[0].x, PATH[1].x, PATH[2].x, PATH[3].x, p),
    y: cubic(PATH[0].y, PATH[1].y, PATH[2].y, PATH[3].y, p),
    depthOffset: sampleDepth(p),
  };
}
