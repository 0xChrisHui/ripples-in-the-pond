'use client';

import { useState, useCallback, useRef } from 'react';

/** 一个视觉事件：按键时产生，动画结束后移除 */
interface VisualEvent {
  id: number;
  /** 圆心 x%（0-100） */
  x: number;
  /** 圆心 y%（0-100） */
  y: number;
  /** 填充颜色 */
  color: string;
  /** 圆的直径（px） */
  size: number;
}

/**
 * 26 个键各对应一个颜色，色相均匀分布在色环上
 * a=0° b≈14° c≈28° ... z≈346°，饱和度 70%，亮度 65%
 */
function keyToColor(key: string): string {
  const index = key.charCodeAt(0) - 97; // a=0, z=25
  const hue = Math.round((index / 26) * 360);
  return `hsl(${hue}, 70%, 65%)`;
}

/** 随机位置，避免太靠边缘 */
function randomPosition(): { x: number; y: number } {
  return {
    x: 15 + Math.random() * 70,
    y: 15 + Math.random() * 70,
  };
}

/** 随机大小：40-120px */
function randomSize(): number {
  return 40 + Math.random() * 80;
}

interface UseKeyVisualReturn {
  /** 传给 useKeyboard 的 onKeyDown，触发视觉事件 */
  triggerVisual: (key: string) => void;
  /** 渲染视觉层 */
  VisualLayer: () => React.JSX.Element;
}

/**
 * 按键视觉反馈 hook — 每次按键产生一个彩色圆形并淡出
 *
 * 设计要点：
 * - 用 CSS @keyframes 做淡出，不依赖 JS 定时器
 * - 动画结束后通过 onAnimationEnd 移除 DOM 节点
 * - 圆形用 absolute 定位覆盖在内容上方，pointer-events: none 不遮挡交互
 */
export function useKeyVisual(): UseKeyVisualReturn {
  const [events, setEvents] = useState<VisualEvent[]>([]);
  const idRef = useRef(0);

  const triggerVisual = useCallback((key: string) => {
    const pos = randomPosition();
    const evt: VisualEvent = {
      id: ++idRef.current,
      x: pos.x,
      y: pos.y,
      color: keyToColor(key),
      size: randomSize(),
    };
    setEvents((prev) => [...prev, evt]);
  }, []);

  const removeEvent = useCallback((id: number) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const VisualLayer = useCallback(() => (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {events.map((evt) => (
        <span
          key={evt.id}
          className="absolute rounded-full animate-jam-ripple"
          style={{
            left: `${evt.x}%`,
            top: `${evt.y}%`,
            width: evt.size,
            height: evt.size,
            backgroundColor: evt.color,
            transform: 'translate(-50%, -50%)',
          }}
          onAnimationEnd={() => removeEvent(evt.id)}
        />
      ))}
    </div>
  ), [events, removeEvent]);

  return { triggerVisual, VisualLayer };
}
