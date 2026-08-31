export const P9_PALETTE_24 = [
  '#dff5ff', '#c9e7ff', '#b7d3ff', '#c7c5ff', '#dfc2ff', '#f4c5ed',
  '#ffc9d6', '#ffd0bd', '#ffdfad', '#f8edaa', '#dff0ad', '#bfe9bb',
  '#a9e3d2', '#9edee5', '#a8d5ee', '#bdc9ee', '#d1c5e9', '#e2c5dc',
  '#edc9ca', '#f0d1ba', '#eadbb7', '#dbe0bd', '#c8dfc8', '#bdded8',
] as const;

export function mixHex(a: string, b: string, amount: number): string {
  const t = Math.max(0, Math.min(1, amount));
  const channels = [1, 3, 5].map((at) => {
    const av = Number.parseInt(a.slice(at, at + 2), 16);
    const bv = Number.parseInt(b.slice(at, at + 2), 16);
    return Math.round(av + (bv - av) * t).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

export function paletteColor(position: number): string {
  const wrapped = ((position % P9_PALETTE_24.length) + P9_PALETTE_24.length) % P9_PALETTE_24.length;
  const index = Math.floor(wrapped);
  return mixHex(P9_PALETTE_24[index], P9_PALETTE_24[(index + 1) % P9_PALETTE_24.length], wrapped - index);
}

/** 圆心在屏外的超大涟漪：屏内只看到圆周的一小段，局部法线决定每个对象的受力方向。 */
export function externalWave(angle: number, progress: number, x: number, y: number): { x: number; y: number; front: number } {
  const cx = 0.5 + Math.cos(angle) * 2.35;
  const cy = 0.5 + Math.sin(angle) * 2.35;
  const dx = x - cx, dy = y - cy;
  const distance = Math.max(0.001, Math.hypot(dx, dy));
  const radius = 1.35 + progress * 2;
  const front = Math.exp(-(((distance - radius) / 0.075) ** 2));
  return { x: dx / distance, y: dy / distance, front };
}
