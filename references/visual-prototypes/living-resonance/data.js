export const CHAPTERS = [
  { name: '潮下花园', prefix: '潮下' },
  { name: '微光群落', prefix: '微光' },
  { name: '深水记忆', prefix: '深水' }
];

export const PALETTE = [
  { membrane: '#5f8f78', core: '#d7a45b' },
  { membrane: '#658f8a', core: '#e0c08a' },
  { membrane: '#806f69', core: '#c88f62' },
  { membrane: '#7f956e', core: '#d3b177' },
  { membrane: '#6c7f91', core: '#d6d8c1' },
  { membrane: '#8a777f', core: '#d19a76' }
];

const NAMES = ['微潮', '苔息', '静脉', '回游', '余温', '藻光', '轻壳', '浅眠', '雾核', '潮痕', '柔礁', '迟雨'];
const QUALIFIERS = ['', '之后', '之下'];
const SCALE = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19, 21];

function fraction(value) {
  return value - Math.floor(value);
}

export function createOrganisms(chapter) {
  return Array.from({ length: 36 }, (_, index) => {
    const column = index % 6;
    const row = Math.floor(index / 6);
    const seed = chapter * 53 + index * 17 + 11;
    return {
      id: chapter * 36 + index + 1,
      index,
      title: `${NAMES[(index + chapter * 4) % NAMES.length]}${QUALIFIERS[(index + chapter) % 3]}`,
      nx: .22 + column * .118 + (fraction(Math.sin(seed) * 91.17) - .5) * .055,
      ny: .19 + row * .125 + (fraction(Math.sin(seed * 1.7) * 48.31) - .5) * .06,
      radius: 13 + fraction(Math.sin(seed * 2.3) * 63.9) * 13,
      phase: fraction(Math.sin(seed * 3.1) * 57.2) * Math.PI * 2,
      drift: .55 + fraction(Math.sin(seed * 4.7) * 39.4) * .8,
      harmonic: 2 + (seed % 4),
      palette: PALETTE[(index + chapter * 2) % PALETTE.length],
      excitation: 0,
      collected: false
    };
  });
}

export const REACTIONS = Array.from({ length: 26 }, (_, index) => ({
  letter: String.fromCharCode(65 + index),
  family: index % 8,
  spokes: 4 + (index % 9),
  turns: 1.2 + (index % 5) * .38,
  duration: .7 + (index % 6) * .14,
  frequency: 110 * Math.pow(2, SCALE[index % SCALE.length] / 12),
  wave: ['sine', 'triangle', 'sine', 'sawtooth'][index % 4],
  color: PALETTE[index % PALETTE.length].core
}));

export const PRESETS = {
  dormant: { flow: .08, breath: .12, membrane: .64, response: .35, trail: .34, halo: .3 },
  listening: { flow: .26, breath: .34, membrane: .48, response: .72, trail: .62, halo: .54 },
  resonant: { flow: .52, breath: .5, membrane: .3, response: .92, trail: .84, halo: .82 }
};
