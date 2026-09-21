'use client';

import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import { fetchMyScoreEvents } from '@/src/data/jam-source';
import { useAuth } from '@/src/hooks/useAuth';
import { useEventsPlayback } from '@/src/hooks/useEventsPlayback';
import { useMintScore } from '@/src/hooks/score/useMintScore';
import type { ArchiveRecording } from '@/src/hooks/me/useMeArchive';
import type { KeyEvent } from '@/src/types/jam';

type Props = { recording: ArchiveRecording; index: number; onQueued: () => void };

function remainingLabel(expiresAt: string, now: number): { label: string; urgent: boolean; expired: boolean } {
  const remaining = new Date(expiresAt).getTime() - now;
  if (remaining <= 0) return { label: '即将消失', urgent: true, expired: true };
  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return { label: `${clock} 后消失`, urgent: remaining <= 60 * 60 * 1000, expired: false };
}

/** 录音行复用全局 Player 与既有入队 hook，不创建第二条音频路径。 */
export default function RecordingArchiveRow({ recording, index, onQueued }: Props) {
  const { getAccessToken } = useAuth();
  const { state: mintState, mint } = useMintScore();
  const { toggle, playing, currentTrack } = usePlayer();
  const [events, setEvents] = useState<KeyEvent[] | null>(recording.events ?? null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const queuedRef = useRef(false);
  const expiredRef = useRef(false);
  const callbackRef = useRef(onQueued);
  useEffect(() => { callbackRef.current = onQueued; });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const trackId = recording.track?.id ?? '';
  const isPlaying = playing && currentTrack?.id === trackId;
  const canPlay = Boolean(recording.track && recording.pendingScoreId && recording.eventCount > 0);
  useEventsPlayback({ events: events ?? [], trackId });

  useEffect(() => {
    if (mintState === 'success' && !queuedRef.current) {
      queuedRef.current = true;
      callbackRef.current();
    }
  }, [mintState]);

  async function playRecording() {
    const { track, pendingScoreId } = recording;
    if (!track || !pendingScoreId || eventsLoading) return;
    if (events) {
      void toggle(track);
      return;
    }
    setEventsLoading(true);
    setEventsError(false);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('登录凭证暂不可用');
      const loaded = await fetchMyScoreEvents(token, pendingScoreId);
      setEvents(loaded);
      void toggle(track);
    } catch (error) {
      console.error('录音播放加载失败:', error);
      setEventsError(true);
    } finally {
      setEventsLoading(false);
    }
  }

  const localState = recording.uploadFailed ? '上传失败，仍保存在此设备' : '仅保存在此设备';
  const expiry = remainingLabel(recording.expiresAt, now);
  useEffect(() => {
    if (expiry.expired && !expiredRef.current) {
      expiredRef.current = true;
      callbackRef.current();
    }
  }, [expiry.expired]);
  return (
    <article className="me-archive-row" data-status={recording.pendingScoreId ? 'ready' : 'local'}
      data-expiry={expiry.urgent ? 'urgent' : 'normal'}>
      <p className="me-archive-row__index">{String(index + 1).padStart(2, '0')}</p>
      <div className="me-archive-row__main">
        <h3>{recording.title}</h3>
        <p>{recording.eventCount} 个演奏事件</p>
        <time dateTime={recording.createdAt}>
          保存于 {new Date(recording.createdAt).toLocaleDateString('zh-CN')}
        </time>
      </div>
      <div className="me-archive-row__state">
        <span>{recording.awaitingRefresh ? '已上传，等待档案刷新' : recording.pendingScoreId ? '已保存录音' : localState}</span>
        <strong className="me-archive-row__expiry">{expiry.label}</strong>
        <small>有效期从创作时间起算</small>
        {eventsError && <small role="alert">试听加载失败，可重试</small>}
      </div>
      {recording.pendingScoreId ? (
        <div className="me-archive-row__actions">
          {canPlay && (
            <button type="button" onClick={playRecording} disabled={eventsLoading}>
              {eventsLoading ? '读取中…' : eventsError ? '重试播放' : isPlaying ? '停止试听' : '试听'}
            </button>
          )}
          {mintState === 'queued' || mintState === 'success' ? (
            <span>{mintState === 'queued' ? '正在提交…' : '已进入制作'}</span>
          ) : (
            <button className="me-archive-row__mint" type="button"
              aria-label={`将${recording.title}制作成唱片`}
              onClick={() => void mint(recording.pendingScoreId!)}>
              {mintState === 'error' ? '重试制作' : '制作唱片'} <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}
