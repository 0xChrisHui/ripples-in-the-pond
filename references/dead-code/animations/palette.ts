/**
 * Phase 6 B2 — patatap 配色（搬自 references/patatap/src/animations/palette.js）
 *
 * Phase 1 只用 palette[0] Grey；Phase 2 可加切换。
 * 颜色用 'rgb(r,g,b)' 字符串，直接喂 Two.js fill/stroke。
 */

export interface PatatapColors {
  background: string;
  middleground: string;
  foreground: string;
  highlight: string;
  accent: string;
  white: string;
  black: string;
}

const RAW = [
  // 0 — Grey
  { bg: [181, 181, 181], mg: [141, 164, 170], fg: [227, 79, 12], hl: [163, 141, 116], ac: [255, 197, 215], w: [255, 255, 255], b: [0, 0, 0] },
  // 1 — White
  { bg: [255, 230, 255], mg: [151, 41, 164], fg: [1, 120, 186], hl: [255, 255, 0], ac: [255, 51, 148], w: [255, 255, 255], b: [255, 255, 255] },
  // 2 — Orange
  { bg: [217, 82, 31], mg: [143, 74, 45], fg: [255, 108, 87], hl: [255, 126, 138], ac: [227, 190, 141], w: [255, 255, 255], b: [0, 0, 0] },
  // 3 — Blue
  { bg: [57, 109, 193], mg: [186, 60, 223], fg: [213, 255, 93], hl: [213, 160, 255], ac: [36, 221, 165], w: [215, 236, 255], b: [0, 0, 0] },
  // 4 — Cream
  { bg: [255, 244, 211], mg: [207, 145, 79], fg: [38, 83, 122], hl: [178, 87, 53], ac: [235, 192, 92], w: [226, 82, 87], b: [0, 0, 0] },
  // 5 — Purple
  { bg: [39, 6, 54], mg: [69, 26, 87], fg: [252, 25, 246], hl: [52, 255, 253], ac: [133, 102, 193], w: [253, 228, 252], b: [255, 255, 255] },
];

const rgb = ([r, g, b]: number[]) => `rgb(${r},${g},${b})`;

export const PALETTES: PatatapColors[] = RAW.map((p) => ({
  background: rgb(p.bg),
  middleground: rgb(p.mg),
  foreground: rgb(p.fg),
  highlight: rgb(p.hl),
  accent: rgb(p.ac),
  white: rgb(p.w),
  black: rgb(p.b),
}));

export const palette = {
  current: 0,
  get colors(): PatatapColors {
    return PALETTES[palette.current];
  },
};
