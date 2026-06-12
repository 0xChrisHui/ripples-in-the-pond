'use client';

/**
 * Phase 8 Lane D — 播放球屏幕坐标广播 store。
 *
 * 为什么需要：beatRipple / echoRipple / playWaves / bubbles 都要在"正在唱歌的球"
 * 屏幕位置上做文章，但它们各自挂 fixed overlay（不进 SphereCanvas/sim，避开 Lane A/E）。
 * 唯一已知道播放球实时屏幕坐标的地方是 render-eclipse-moon（每 tick 更新日食月亮元素）。
 *
 * 所以让 render-eclipse-moon 把日食元素的 getBoundingClientRect 中心（已含 zoom/tilt/
 * perspective 的真实屏幕像素）写进本 store，命令式消费者（overlay 的 rAF）直接读。
 * 模块级 store 而非 context：overlay 用 createElementNS 命令式生成，拿不到 React context。
 *
 * 没有播放球时 visible=false，消费者据此停手（优雅降级）。
 */

export interface PlaySpherePos {
  x: number;
  y: number;
  /** 屏幕上的半径估算（px），供涟漪/气泡定位时给一个量级 */
  r: number;
  visible: boolean;
}

const pos: PlaySpherePos = { x: 0, y: 0, r: 40, visible: false };
const listeners = new Set<() => void>();

export function getPlaySpherePos(): PlaySpherePos {
  return pos;
}

/** render-eclipse-moon 每 tick 调一次（命中播放球时） */
export function setPlaySpherePos(x: number, y: number, r: number): void {
  const was = pos.visible;
  pos.x = x;
  pos.y = y;
  pos.r = r;
  if (!pos.visible) {
    pos.visible = true;
    if (!was) listeners.forEach((l) => l());
  }
}

/** 没有播放球 / stop 时调一次 */
export function clearPlaySpherePos(): void {
  if (pos.visible) {
    pos.visible = false;
    listeners.forEach((l) => l());
  }
}

/** 仅在 visible 翻转时通知（连续坐标更新走轮询，不触发 listener，避免每帧 re-render） */
export function subscribePlaySpherePos(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * audioPulse flag 的模块级镜像。
 * render-eclipse-moon（非 React，且属 Lane D 文件）据此决定月亮是否随 env 脉动；
 * 由 Lane D 协调组件从 effects.audioPulse 写入——避免把 flag 线穿过 use-sphere-sim（Lane A）。
 */
let audioPulseOn = false;
export function setAudioPulseEnabled(v: boolean): void {
  audioPulseOn = v;
}
export function isAudioPulseEnabled(): boolean {
  return audioPulseOn;
}
