'use client';

import { useEffect } from 'react';
import { getRippleTuning } from './spike/ripple-tuning';

/**
 * G6 — 水位 store + 滚轮控制（程序化单例，范式同 sphere-tuning）。
 * H5：升格为对象运动的**通用共享水位变量**——既驱动渲染（WaterDistort 遮罩 / 球淡出 / 指示器），
 *      又驱动对象运动公式（sphere-motion 的浮沉/焦点都读 getWaterLevel）。
 *
 * 水位 L ∈ [0,1]，直接映射球的 z 域（gl-sim-setup.ts 里 node.z ∈ [0,1]）。
 * - target：滚轮拨到的目标水位
 * - current：缓动后的实时水位（shader / 指示器 / 运动公式每帧读，避免突跳）
 * 命令式 mutate 放模块级（避 react-hooks/immutability）；不做 pub/sub —— 读方全部走 rAF/useFrame 直读，
 * 不触发 React 重渲染（同 SphereOverlay 的每帧 DOM 写法）。
 */

// J2 — 双指捏合的像素差 → 等效滚轮 deltaY（喂 nudgeWaterLevel）。拉开≈升、捏拢≈降水位。
const PINCH_TO_WHEEL = 2;

let target = 0;
let current = 0;
let lastWheelAt = -9999; // 指示器淡入用：最近一次滚轮的时间戳（performance.now）

/**
 * 「有效水位」域端点 = 水面滚动范围（深度轴 100 层模型：0=塘底/100=顶；球分布在 30–80 层=z∈[0.30,0.80]）。
 * 原始 current∈[0,1] 是滚轮控制量，线性映射到水面层 [10,100]/100=[0.10,1.00] 喂给所有"没入判定"
 * （shader 没入遮罩/深度、getSubmerge、depthFactor、浮沉焦点）：
 *   current=0 → 水面层 10（低于最低球层 30，留 20 层余量 → 全部球出水/悬空）；
 *   current=1 → 水面层 100（高于最高球层 80，留 20 层余量 → 全部球没入）。
 * K6 缩放/滴水缩放仍读原始 current（getWaterLevel）→ 缩放量与没入覆盖解耦，互不影响。
 */
const EFF_LOW = 0.10;   // current=0 → 水面层 10（< 最低球层 30，全出水）
const EFF_HIGH = 1.00;  // current=1 → 水面层 100（> 最高球层 80，全没入）

/** K6 缩放/滴水缩放读的「原始水位」current（已缓动，∈[0,1]）。 */
export function getWaterLevel(): number {
  return current;
}

/** 没入判定 + 指示器/水线读的「有效水位」= 水面层归一（current 线性映射到 [EFF_LOW,EFF_HIGH]=层 10–100/100）。 */
export function getEffectiveWaterLevel(): number {
  return EFF_LOW + (EFF_HIGH - EFF_LOW) * current;
}

/** 给定 current 值算有效水位（getSubmerge/depthFactor 内部用，避免重复读 current）。 */
function effective(): number {
  return EFF_LOW + (EFF_HIGH - EFF_LOW) * current;
}
/** 指示器读：最近滚轮时间，用于"滚轮时淡入、静止后淡出" */
export function getLastWheelAt(): number {
  return lastWheelAt;
}

/** 滚轮拨动水位：deltaY<0（上滚）抬高水位、更多球入水；clamp [0,1] */
const WHEEL_BASE = 0.0008; // 基准灵敏度（×wheelSens 倍率，面板可调；1.0 倍 = 历史现状）
export function nudgeWaterLevel(deltaY: number): void {
  target = Math.max(0, Math.min(1, target - deltaY * WHEEL_BASE * getRippleTuning().wheelSens));
  lastWheelAt = performance.now();
}

/** 每帧把 current 缓动逼近 target（lerp 0.12，同球 hover/dim 的手感） */
export function stepWaterLevel(): void {
  current += (target - current) * 0.12;
  if (Math.abs(target - current) < 0.0004) current = target;
}

/**
 * 球的"没入程度" 0..1：0 = 水上/贴面（露出，原样）、1 = 完全没入（被水波盖住、淡出）。
 * 用 current(已缓动) − 球 z 判定：z 越低于水位越没入。阈值即三态边界（贴面带 ≈ -0.02..0）。
 * 集中在此 → 球淡出与 overlay 标题淡出共用同一判定（G6-2 贴面涟漪也复用）。
 */
export function getSubmerge(z: number): number {
  const t = Math.min(1, Math.max(0, (effective() - z + 0.02) / 0.12)); // 用有效水位 → 全 z 域两端可达 0/1
  return t * t * (3 - 2 * t); // smoothstep 软化出入水
}

/**
 * K3 深度因子 d ∈[0,1]：球相对水位的"水下深度"（0=贴水面/水上、1=塘底 pondDepth 处）。
 * s = current − z（>0 越深没入）；d = clamp(s/pondDepth)。球/标题/水面三个消费方共用此 d，
 * 浮沉时 d 连续变 → 三效果一起连续变（统一 R4 的不一致 + 让浮沉"看得见"）。
 */
export function depthFactor(z: number, pondDepth: number): number {
  return Math.min(1, Math.max(0, (effective() - z) / Math.max(0.001, pondDepth)));
}

/**
 * 滚轮控制 + 缓动驱动 hook。active=false（wheelMode≠waterLevel 或水面关）时**不挂任何监听**，
 * 滚轮回归原行为（GL 沙盒里 SVG 已隐，等于无操作；P2-c 后归 GL 缩放）。
 */
export function useWaterLevelControl(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    // 桌面滚轮：preventDefault 截断页面滚动；passive:false 才允许 preventDefault
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      nudgeWaterLevel(e.deltaY);
    };
    // J2 触屏双指捏合控水位：仅双指时 preventDefault（拦浏览器缩放）；单指不拦 →
    // 留给球的拖/点（SphereOverlay 的 pointer 事件，命中 div 已 touchAction:none）。
    let lastDist = 0;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e: TouchEvent) => { if (e.touches.length === 2) lastDist = dist(e.touches); };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const d = dist(e.touches);
      if (lastDist) nudgeWaterLevel(-(d - lastDist) * PINCH_TO_WHEEL); // 拉开(d↑)→负 deltaY→升水位
      lastDist = d;
    };
    const onTouchEnd = (e: TouchEvent) => { if (e.touches.length < 2) lastDist = 0; };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    // 独立 rAF 只负责缓动；读方（球 shader / 指示器）各自 rAF 直读 current
    let raf = 0;
    const loop = () => {
      stepWaterLevel();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      cancelAnimationFrame(raf);
    };
  }, [active]);
}
