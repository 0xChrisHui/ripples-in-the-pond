/** 改动此版本会改变首页初始排布，必须重新做 P8/P9 视觉回归。 */
export const HOME_LAYOUT_VERSION = 'pond-layout-v1';

function hashParts(parts: readonly string[]): number {
  let hash = 2166136261;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash ^= part.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 0xff;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Mulberry32：相同命名空间永远产生相同序列，不依赖全局 Math.random。 */
export function createLayoutRandom(...parts: string[]): () => number {
  let state = hashParts([HOME_LAYOUT_VERSION, ...parts]);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

/** 单个属性用无状态 seed，新增节点不会改变既有节点的属性。 */
export function layoutUnit(...parts: string[]): number {
  return createLayoutRandom(...parts)();
}

