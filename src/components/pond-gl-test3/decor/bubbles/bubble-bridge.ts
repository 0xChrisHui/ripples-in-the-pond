/**
 * P20 气泡（Canvas 内的模拟）与手记（Canvas 外的 HTML 宿主）之间的小状态：
 * 载体泡停在水面时登记坐标（屏幕分数，窗口缩放后仍对得上），宿主读它出字，字退场后 release → 泡才破。
 * 模块级单例 + 订阅（宿主用 useSyncExternalStore）；气泡模拟每帧只在到达 / 清场时写，不会高频触发。
 */
export interface Carrier { id: number; u: number; v: number }
export interface CarrierPort {
  arrive: (x: number, y: number) => number; // 载体泡到达水面；返回 id（0 = 宿主不可用，泡照常破）
  isReleased: (id: number) => boolean;
  clear: () => void;                        // 减弱动效等强制清场
}

type Listener = () => void;
const listeners = new Set<Listener>();
let hosts = 0;
let carrier: Carrier | null = null;
let nextId = 1;
let suppress = false;

const emit = () => listeners.forEach((l) => l());

export function subscribeBridge(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export function getCarrier(): Carrier | null { return carrier; }
/** 宿主挂载时登记；没有宿主就不挑载体串（避免泡停在水面没人放行）。 */
export function registerNoteHost(): () => void {
  hosts++;
  return () => { hosts--; if (hosts <= 0) { hosts = 0; releaseCarrier(); } };
}
export function hasNoteHost(): boolean { return hosts > 0; }
/** 播放（日蚀）或减弱动效期间为 true：宿主应撤下当前手记。只在值变化时通知。 */
export function setSuppressed(v: boolean): void {
  if (v === suppress) return;
  suppress = v;
  emit();
}
export function isSuppressed(): boolean { return suppress; }
export function releaseCarrier(): void {
  if (!carrier) return;
  carrier = null;
  emit();
}

export function makeCarrierPort(getSize: () => { w: number; h: number }): CarrierPort {
  return {
    arrive(x, y) {
      if (hosts <= 0) return 0;
      const { w, h } = getSize();
      const id = nextId++;
      carrier = { id, u: x / w, v: y / h };
      emit();
      return id;
    },
    isReleased: (id) => carrier?.id !== id, // 登记被清（宿主放行 / 清场 / 卸载）即视为放行
    clear: releaseCarrier,
  };
}
