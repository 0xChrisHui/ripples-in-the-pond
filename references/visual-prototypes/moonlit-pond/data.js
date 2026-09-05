export const CHAPTERS = [
  { roman: "Ⅰ", title: "薄明", tone: "#c6a176" },
  { roman: "Ⅱ", title: "潮汐", tone: "#8ea9a5" },
  { roman: "Ⅲ", title: "余夜", tone: "#a4868d" },
];

const NAMES = [
  "未醒的水", "白露", "风经过石头", "浅眠", "第一圈涟漪", "苔痕",
  "月落之前", "静默的岸", "潮汐来信", "一尾微光", "薄雾", "水中庭",
  "雨的背面", "夜航", "浮叶", "远处的钟", "青石", "缓慢回声",
  "无名水径", "野莲", "月之井", "旧梦入水", "晚风", "池畔手记",
  "暗香", "潮痕", "碎金", "游鱼之眠", "第二个月亮", "深青",
  "风止之处", "雨后书", "一寸波光", "静水之下", "归岸", "余韵",
];

const PALETTES = [
  ["#c18b6a", "#b9aa88", "#728f83", "#8093a0", "#b9868a", "#d1c8ae"],
  ["#a47f66", "#899c8d", "#718d91", "#b1a486", "#9b7f83", "#c6c0aa"],
  ["#ad866c", "#667e75", "#73828e", "#a98e76", "#8c747d", "#c1b9a4"],
];

const seeded = (value) => {
  const x = Math.sin(value * 91.713 + 17.31) * 43758.5453;
  return x - Math.floor(x);
};

export function createTracks(chapter) {
  return NAMES.map((name, index) => {
    const globalIndex = chapter * 36 + index + 1;
    const row = Math.floor(index / 6);
    const column = index % 6;
    const jitterX = (seeded(globalIndex) - .5) * .052;
    const jitterY = (seeded(globalIndex + 80) - .5) * .045;
    return {
      id: globalIndex,
      number: String(globalIndex).padStart(3, "0"),
      title: name,
      chapter,
      color: PALETTES[chapter][(index + row) % 6],
      nx: .18 + column * .132 + jitterX,
      ny: .19 + row * .112 + jitterY,
      radius: 10 + seeded(globalIndex + 140) * 11,
      phase: seeded(globalIndex + 220) * Math.PI * 2,
      membrane: 2 + Math.floor(seeded(globalIndex + 300) * 4),
    };
  });
}

export const KEY_MOTIONS = [
  "ring", "double", "soft", "spiral", "drop", "wide", "pulse",
  "arc", "quiet", "twin", "wake", "low", "mist",
];
