export interface PlaybackFocus {
  active: boolean;
  trackId: string | null;
  x: number;
  y: number;
  scale: number;
}

const EMPTY_FOCUS: PlaybackFocus = { active: false, trackId: null, x: 0.5, y: 0.5, scale: 1 };
let playbackFocus = EMPTY_FOCUS;
let eclipseMix = 0;

export function getPlaybackFocus(): PlaybackFocus {
  return playbackFocus;
}

export function setPlaybackFocus(focus: PlaybackFocus): void {
  playbackFocus = focus;
}

export function clearPlaybackFocus(): void {
  playbackFocus = EMPTY_FOCUS;
}

export function getEclipseMix(): number {
  return eclipseMix;
}

/** 水底贴图到黑色贴图的半衰式过渡；约 450ms 到视觉终点。 */
export function advanceEclipseMix(target: number, deltaMs: number, reduced: boolean): number {
  eclipseMix = blendEclipseMix(eclipseMix, target, deltaMs, reduced);
  return eclipseMix;
}

/** 前景和水面共用同一过渡曲线；局部圆也可独立计算自己的视觉进度。 */
export function blendEclipseMix(current: number, target: number, deltaMs: number, reduced: boolean): number {
  if (reduced) return target;
  else {
    const amount = 1 - Math.exp(-Math.min(64, Math.max(0, deltaMs)) / 95);
    const next = current + (target - current) * amount;
    return Math.abs(target - next) < 0.006 ? target : next;
  }
}

export function resetEclipseMix(): void {
  eclipseMix = 0;
}
