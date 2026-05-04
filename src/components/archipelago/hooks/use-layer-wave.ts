'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { NUM_LAYERS, type SimNode } from '../sphere-config';

export interface LayerWaveEvent {
  startTime: number;
  duration: number;
  targetLayer: number; // 1 (kmax 最大球) 或 NUM_LAYERS (kmin 最小球)
}

/**
 * v86 — layerWave 事件驱动调度（取代 v80 36 球持续双频波动）
 *
 * 每 2s 随机选 1 球进入波动；进入后 8-12s 走 sin(π·t) 钟形：
 * baseLayer → targetLayer (1 或 NUM_LAYERS) → baseLayer。
 *
 * 性能：每帧只查 Map（最多 1-3 个 active wave），不再是 36 球 sin/cos。
 * 跳过已在波动中的球避免重叠。
 *
 * sim tick 消费方式：
 *   const wave = mapRef.current.get(n.id);
 *   if (wave) {
 *     const p = (now - wave.startTime) / wave.duration;
 *     if (p > 0 && p < 1) {
 *       const dynL = n.baseLayer + (wave.targetLayer - n.baseLayer) * Math.sin(p * Math.PI);
 *       scale *= fLayer(dynL) / fLayer(n.baseLayer);
 *     }
 *   }
 */
export function useLayerWave(
  simNodes: SimNode[],
  enabled: boolean,
): RefObject<Map<string, LayerWaveEvent>> {
  const mapRef = useRef<Map<string, LayerWaveEvent>>(new Map());
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    mapRef.current.clear();
    if (simNodes.length === 0) return;

    const removalTimers: number[] = [];
    let triggerTimer: number | null = null;

    const triggerNext = () => {
      const delay = 2000; // v86 — 固定 2s
      triggerTimer = window.setTimeout(() => {
        if (enabledRef.current && simNodes.length > 0) {
          const node = simNodes[Math.floor(Math.random() * simNodes.length)];
          if (!mapRef.current.has(node.id)) {
            const duration = 8000 + Math.random() * 4000; // 8-12s
            const targetLayer = Math.random() < 0.5 ? 1 : NUM_LAYERS;
            mapRef.current.set(node.id, {
              startTime: performance.now(),
              duration,
              targetLayer,
            });
            const removeId = window.setTimeout(() => {
              mapRef.current.delete(node.id);
            }, duration + 50);
            removalTimers.push(removeId);
          }
        }
        triggerNext();
      }, delay);
    };
    triggerNext();

    return () => {
      if (triggerTimer !== null) window.clearTimeout(triggerTimer);
      removalTimers.forEach((id) => window.clearTimeout(id));
      mapRef.current.clear();
    };
  }, [simNodes]);

  return mapRef;
}
