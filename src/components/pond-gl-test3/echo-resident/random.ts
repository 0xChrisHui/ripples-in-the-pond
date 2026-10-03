import type { ResidentRandom, ResidentRandomStream, ResidentRange } from '../../../types/echo-resident';

function stream(seed: number): ResidentRandomStream {
  let state = seed >>> 0, calls = 0;
  return {
    get calls() { return calls; },
    next() {
      calls++;
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), state | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
/** 四条随机流只在换段时取值，显隐变化不会改写漂移路线。 */
export function createResidentRandom(seed: number): ResidentRandom {
  const s = Number.isFinite(seed) ? seed >>> 0 : 0;
  return { drift: stream(s ^ 0xa341316c), depth: stream(s ^ 0xc8013ea4),
    scale: stream(s ^ 0xad90777d), presence: stream(s ^ 0x7e95761e) };
}
export function sampleRange(random: ResidentRandomStream, [min, max]: ResidentRange): number {
  return min + random.next() * (max - min);
}
export function createVisualSeed(): number {
  // 视觉种子只创建一次，不包含钱包、配方或任何资产身份。
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}
