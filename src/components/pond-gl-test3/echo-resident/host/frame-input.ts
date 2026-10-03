import type { ResidentEchoFrameInput, ResidentEchoPose, ResidentHostFrameState } from '@/src/types/echo-resident';

export function isResidentPlaybackFocus(trackId: string | null, playbackId: string | undefined,
  pose: ResidentEchoPose | null): boolean {
  // 日食会使场景透明度归零；播放焦点仍由播放身份与冻结坐标维持。
  return !!trackId && trackId === playbackId && !!pose && pose.bodyRadiusPx > 0;
}

const unit = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
/** 消费主线已有路由/日食连续值；暂停保持播放锁，不依音频进度推测退场完成。 */
export function resolveResidentHostFrame(state: ResidentHostFrameState): ResidentEchoFrameInput {
  const route = unit(state.routePresence), eclipse = unit(state.eclipseMix);
  const playbackHeld = ['loading', 'playing', 'paused'].includes(state.playback);
  return { layout: state.layout, available: state.echoAvailable,
    healthy: state.healthy, sceneReady: state.sceneReady && state.homeActive,
    scenePresence: state.homeActive ? route * (1 - eclipse) : 0,
    sceneRestored: state.homeActive && route === 1 && eclipse === 0
      && !state.otherPlaybackActive && !playbackHeld,
    reducedMotion: state.reducedMotion ?? false, playback: state.playback,
    otherPlaybackActive: state.otherPlaybackActive };
}
