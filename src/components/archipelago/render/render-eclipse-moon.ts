/**
 * v87 — eclipse moon transform 更新，从 use-sphere-sim 抽出。
 *
 * 单元素更新：根据当前播放球的位置 + tilt + layerWave2 + perspective 算
 * <g eclipseGRef> 的 transform，同步 display:block/none。
 *
 * 未来如果月亮加新效果（halo 律动、轨道动画等）都集中到这里。
 */

import { fLayer, type SimNode } from '../sphere-config';
import { tiltCoef, persp } from './render-helpers';
import type { LayerWaveEvent } from '../hooks/use-layer-wave';
import { setPlaySpherePos, clearPlaySpherePos, isAudioPulseEnabled } from '../hooks/pond/use-play-sphere-pos';
import { getAudioEnv } from '../hooks/pond/use-audio-energy';

export interface RenderEclipseMoonArgs {
  eclipseEl: SVGGElement | null;
  simNodes: SimNode[];
  playingId: string | null;
  zMap: Map<string, number>;
  layerWaveMap: Map<string, LayerWaveEvent>;
  tiltX: number;
  tiltY: number;
  cx: number;
  cy: number;
  k: number;
  now: number;
  layerWave2: boolean;
  perspective: boolean;
}

export function renderEclipseMoon(a: RenderEclipseMoonArgs): void {
  if (!a.eclipseEl) return;
  const pn = a.playingId ? a.simNodes.find((n) => n.id === a.playingId) : null;
  if (pn && pn.x != null && pn.y != null) {
    const baseS = pn.radius / 50;
    const pz = a.zMap.get(pn.id) ?? 0.5; // v87 Z1 — 删 z 抖动
    const pTc = tiltCoef(pz);
    let ex = pn.x + a.tiltX * pTc;
    let ey = pn.y + a.tiltY * pTc;
    let eScale = baseS;
    // 同步 layerWave2：wave 中的播放球，月亮跟着 fLayer 比例缩放
    if (a.layerWave2) {
      const wave = a.layerWaveMap.get(pn.id);
      if (wave) {
        const progress = (a.now - wave.startTime) / wave.duration;
        if (progress > 0 && progress < 1) {
          const effL = pn.baseLayer + (wave.targetLayer - pn.baseLayer) * Math.sin(progress * Math.PI);
          eScale *= fLayer(effL) / fLayer(pn.baseLayer);
        }
      }
    }
    if (a.perspective) {
      const p = persp(ex, ey, pz, a.cx, a.cy, a.k);
      ex = p.x; ey = p.y; eScale *= p.factor;
    }
    // Lane D audioPulse — 日食月亮随低频能量同步脉动（scale *= 1 + env*0.07）
    if (isAudioPulseEnabled()) {
      eScale *= 1 + getAudioEnv() * 0.07;
    }
    a.eclipseEl.setAttribute('transform', `translate(${ex},${ey}) scale(${eScale})`);
    a.eclipseEl.style.display = 'block';
    // Lane D — 把日食元素的真实屏幕中心（含 zoom 的 getBoundingClientRect）广播给
    // beatRipple / echoRipple / playWaves / bubbles 的 overlay 消费者。
    const rect = a.eclipseEl.getBoundingClientRect();
    setPlaySpherePos(rect.left + rect.width / 2, rect.top + rect.height / 2, rect.width / 2);
  } else {
    a.eclipseEl.style.display = 'none';
    clearPlaySpherePos();
  }
}
