/**
 * Lane C 物理线 — 实时物理开关单例
 *
 * sphere-sim-setup 的 sim 只在 [simNodes,simLinks] 变化时重建，不随 effects 重跑；
 * 故 springBack/viscous/breeze 必须由 tick 实时读取这个单例（而非 setup 入参）。
 * React 侧 syncPhys('pond:phys-config') 广播 → 本模块单例监听写入。
 */

export interface PhysConfig {
  springBack: boolean;
  viscous: boolean;
  breeze: boolean;
}

const phys: PhysConfig = { springBack: false, viscous: false, breeze: false };

// 模块级一次性监听：单例窗口事件，无需卸载（随页面生命周期）。
if (typeof window !== 'undefined') {
  window.addEventListener('pond:phys-config', (e: Event) => {
    const d = (e as CustomEvent<Partial<PhysConfig>>).detail;
    if (d.springBack != null) phys.springBack = d.springBack;
    if (d.viscous != null) phys.viscous = d.viscous;
    if (d.breeze != null) phys.breeze = d.breeze;
  });
}

/** sim 侧读取（tick 内调用，零分配） */
export function getPhys(): Readonly<PhysConfig> {
  return phys;
}

/** React 侧调用：把当前 effects 三开关广播给 sim */
export function syncPhys(cfg: PhysConfig): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('pond:phys-config', { detail: cfg }));
}
