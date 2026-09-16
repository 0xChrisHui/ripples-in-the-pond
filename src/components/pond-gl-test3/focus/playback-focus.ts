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
  if (reduced) eclipseMix = target;
  else {
    const amount = 1 - Math.exp(-Math.min(64, Math.max(0, deltaMs)) / 95);
    eclipseMix += (target - eclipseMix) * amount;
    if (Math.abs(target - eclipseMix) < 0.006) eclipseMix = target;
  }
  return eclipseMix;
}

export function resetEclipseMix(): void {
  eclipseMix = 0;
}
