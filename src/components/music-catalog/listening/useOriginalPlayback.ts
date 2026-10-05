'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayer } from '../../player/PlayerProvider';
import { getTrackImprint } from '../../../lib/music-catalog/experience/imprints';
import { originalAudioSources, releaseOriginalPlayback, toPlayerTrack } from '../../../lib/music-catalog/player-adapter';
import type { OriginalTrack } from '../../../lib/music-catalog/types';

export type OriginalPlaybackPhase = 'idle' | 'preparing' | 'playing' | 'ended' | 'error';
type Snapshot = { trackId: string; phase: OriginalPlaybackPhase; position: number; duration: number };

/** 只观察共享 HTMLAudio 的真实进展，保留全局停止及网关回退语义。 */
export function useOriginalPlayback(track: OriginalTrack) {
  const { trackId } = track;
  const knownDuration = getTrackImprint(trackId)?.durationSeconds ?? 0;
  const { currentTrack, playbackError, getAudioElement, stop, toggle, seek: playerSeek, subscribe } = usePlayer();
  const [snapshot, setSnapshot] = useState<Snapshot>({ trackId, phase: 'idle', position: 0, duration: knownDuration });
  const session = useRef({ generation: 0, active: false, pending: false, observed: false,
    recovering: false, previousTime: 0, retries: 0 });
  const detach = useRef<(() => void) | null>(null);
  const restart = useRef<(() => Promise<void>) | null>(null);

  const bindAudio = useCallback(() => {
    detach.current?.();
    const audio = getAudioElement();
    if (!audio) return;
    const generation = session.current.generation;
    const sources = originalAudioSources(trackId);
    const valid = () => session.current.active && session.current.generation === generation
      && sources.includes(audio.currentSrc || audio.src);
    const update = (phase?: OriginalPlaybackPhase) => {
      if (!valid()) return;
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : knownDuration;
      const position = Math.min(duration, Math.max(0, audio.currentTime));
      setSnapshot((previous) => ({ trackId, phase: phase ?? previous.phase, position, duration }));
    };
    const playing = () => {
      if (!audio.paused && !audio.ended && audio.readyState >= audio.HAVE_FUTURE_DATA) update('playing');
    };
    const progress = () => {
      if (!valid()) return;
      const advancing = audio.currentTime > session.current.previousTime + 0.005;
      session.current.previousTime = audio.currentTime;
      update(advancing && !audio.paused && !audio.seeking ? 'playing' : undefined);
    };
    const preparing = () => update('preparing');
    const ended = () => {
      if (!audio.ended) return;
      update('ended');
      if (valid()) { session.current.active = false; session.current.pending = false; }
    };
    const paused = () => {
      if (valid() && audio.paused && !session.current.pending && !session.current.recovering && !audio.ended) {
        update('idle'); session.current.active = false;
      }
    };
    const failed = () => {
      if (!valid()) return;
      preparing();
      // 单个网关报错不代表整首不可用；播放中断也交回现有完整回退链路。
      if (!session.current.pending) {
        session.current.retries += 1;
        if (session.current.retries >= sources.length) { update('error'); session.current.active = false; stop(); }
        else { session.current.recovering = true; stop(); }
      }
    };
    const seeked = () => { if (valid()) session.current.previousTime = audio.currentTime; };
    const events: [string, () => void][] = [
      ['playing', playing], ['timeupdate', progress], ['waiting', preparing], ['stalled', preparing],
      ['error', failed], ['ended', ended], ['pause', paused], ['loadedmetadata', () => update()], ['seeked', seeked],
    ];
    events.forEach(([name, listener]) => audio.addEventListener(name, listener));
    detach.current = () => events.forEach(([name, listener]) => audio.removeEventListener(name, listener));
    // 切歌可先于观察组件提交出声；接管时同步真实媒体状态，不能漏掉 playing 事件。
    update(!audio.paused && !audio.ended && audio.readyState >= audio.HAVE_FUTURE_DATA ? 'playing' : 'preparing');
  }, [getAudioElement, knownDuration, stop, trackId]);

  const start = useCallback(async () => {
    const generation = ++session.current.generation;
    session.current.active = true; session.current.pending = true; session.current.recovering = false;
    session.current.previousTime = 0;
    setSnapshot({ trackId, phase: 'preparing', position: 0, duration: knownDuration });
    try {
      const sourceIndex = session.current.retries % originalAudioSources(trackId).length;
      // toggle 同步创建共享音频；紧接着绑定，先于原生异步 playing 事件。
      const request = toggle(toPlayerTrack(trackId, sourceIndex));
      bindAudio();
      await request;
      if (!session.current.active || session.current.generation !== generation) return;
      const audio = getAudioElement();
      if (!audio || audio.error || (audio.paused && !audio.ended)) {
        session.current.active = false;
        setSnapshot({ trackId, phase: 'error', position: 0, duration: knownDuration });
        stop();
      }
    } catch (error) {
      if (session.current.active && session.current.generation === generation) {
        console.error('原曲完整网关回退失败', { trackId, error });
        session.current.active = false;
        setSnapshot({ trackId, phase: 'error', position: 0, duration: knownDuration });
        stop();
      }
    } finally {
      if (session.current.generation === generation) session.current.pending = false;
    }
  }, [bindAudio, getAudioElement, knownDuration, stop, toggle, trackId]);

  useEffect(() => { restart.current = start; }, [start]);
  useEffect(() => {
    const control = session.current;
    const unsubscribe = subscribe({ onBeforePlay: (next) => {
      if (next.id !== trackId) {
        session.current.generation += 1; session.current.active = false; session.current.pending = false;
        session.current.recovering = false;
        detach.current?.();
      }
    } });
    return () => {
      control.generation += 1; control.active = false;
      control.pending = false; control.observed = false; control.recovering = false;
      detach.current?.(); unsubscribe();
      releaseOriginalPlayback(trackId, { getAudioElement, stop });
    };
  }, [getAudioElement, stop, subscribe, trackId]);

  const currentId = currentTrack?.id;
  useEffect(() => {
    if (currentId === trackId) {
      session.current.observed = true; session.current.active = true;
      bindAudio();
    } else if (session.current.observed) {
      session.current.generation += 1; session.current.active = false; session.current.pending = false;
      session.current.observed = false; detach.current?.();
      // 全局 stop 提交后再调用更新过的 toggle，旧闭包不会把恢复当成停止。
      if (session.current.recovering) void restart.current?.();
    }
  }, [bindAudio, currentId, trackId]);

  async function action(): Promise<void> {
    session.current.recovering = false;
    if (session.current.active || currentId === trackId) {
      session.current.generation += 1; session.current.active = false; session.current.pending = false;
      detach.current?.(); stop();
      setSnapshot({ trackId, phase: 'idle', position: 0, duration: knownDuration });
      return;
    }
    session.current.retries = 0;
    await start();
  }

  const phase: OriginalPlaybackPhase = playbackError === trackId ? 'error' : snapshot.trackId !== trackId ? 'idle'
    : snapshot.phase === 'ended' || snapshot.phase === 'error' || currentId === trackId ? snapshot.phase : 'idle';
  const duration = snapshot.trackId === trackId ? snapshot.duration : knownDuration;
  const position = phase === 'idle' ? 0 : snapshot.position;
  function seek(seconds: number): void {
    if (currentId !== trackId || !Number.isFinite(seconds)) return;
    const target = Math.min(duration, Math.max(0, seconds));
    playerSeek(target);
    session.current.previousTime = getAudioElement()?.currentTime ?? target;
    setSnapshot((previous) => ({ ...previous, position: target }));
  }
  return { phase, position, duration, action, seek };
}
