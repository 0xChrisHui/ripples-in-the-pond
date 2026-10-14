'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMsg } from '@/src/i18n/msg';
import { useServerText } from '@/src/i18n/use-server-text';
import { usePlayer } from '@/src/components/player/PlayerProvider';
import { fetchMyScoreEvents } from '@/src/data/jam-source';
import { useAuth } from '@/src/hooks/useAuth';
import { useEventsPlayback } from '@/src/hooks/useEventsPlayback';
import { useMintScore } from '@/src/hooks/score/useMintScore';
import { useArchiveMintContext } from '@/src/components/mint/archive/ArchiveMintProvider';
import type { ArchiveRecording } from '@/src/hooks/me/useMeArchive';
import type { KeyEvent } from '@/src/types/jam';

type Props = { recording: ArchiveRecording; index: number; onQueued: () => void };

/** clock 为空表示已到期 */
function remainingLabel(expiresAt: string, now: number): { clock: string | null; urgent: boolean; expired: boolean } {
  const remaining = new Date(expiresAt).getTime() - now;
  if (remaining <= 0) return { clock: null, urgent: true, expired: true };
  const totalSeconds = Math.ceil(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return { clock, urgent: remaining <= 60 * 60 * 1000, expired: false };
}

/** 录音行复用全局 Player 与既有入队 hook，不创建第二条音频路径。 */
export default function RecordingArchiveRow({ recording, index, onQueued }: Props) {
  const t = useTranslations('me.recording');
  const msgText = useMsg();
  const serverText = useServerText();
  const auth = useAuth();
  const archiveMint = useArchiveMintContext();
  const { state: mintState, mint } = useMintScore();
  const { toggle, playing, currentTrack } = usePlayer();
  const [events, setEvents] = useState<KeyEvent[] | null>(recording.events ?? null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [selfMintBusy, setSelfMintBusy] = useState(false);
  /** server：服务端/抛出的原文（中文模式照旧显示） */
  const [selfMintError, setSelfMintError] = useState<{ key: 'reconnect' | 'archiveFailed'; server?: string } | null>(null);
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
      const token = await auth.getAccessToken();
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

  async function prepareEthereumMint() {
    const wallet = auth.selectedExternalWallet;
    if (!wallet || !auth.walletCapability.canSelfPayEthGas || !recording.pendingScoreId) {
      setSelfMintError({ key: 'reconnect' });
      return;
    }
    setSelfMintBusy(true);
    setSelfMintError(null);
    try {
      const token = await auth.getAccessToken();
      if (!token) throw new Error('登录已失效');
      const response = await fetch('/api/self-mint/prepare', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingScoreId: recording.pendingScoreId, walletAddress: wallet.address,
        }),
      });
      const result = await response.json() as { orderId?: `0x${string}`; error?: string };
      if (!response.ok || !result.orderId) throw new Error(result.error ?? '作品档案建立失败');
      archiveMint.openOrder(result.orderId);
    } catch (caught) {
      setSelfMintError({ key: 'archiveFailed', server: caught instanceof Error ? caught.message : undefined });
      setSelfMintBusy(false);
    }
  }

  const localState = t(recording.uploadFailed ? 'uploadFailed' : 'localOnly');
  const title = recording.label ? msgText(recording.label) : recording.title;
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
        <h3>{title}</h3>
      </div>
      <div className="me-archive-row__state">
        <strong className="me-archive-row__expiry">{expiry.clock ? t('expiresIn', { clock: expiry.clock }) : t('expired')}</strong>
        {recording.awaitingRefresh && <small>{t('syncing')}</small>}
        {!recording.pendingScoreId && <small>{localState}</small>}
        {eventsError && <small role="alert">{t('previewFailed')}</small>}
        {selfMintError && <small role="alert">{serverText(selfMintError.server, t(selfMintError.key))}</small>}
      </div>
      {recording.pendingScoreId ? (
        <div className="me-archive-row__actions">
          {canPlay && (
            <button type="button" onClick={playRecording} disabled={eventsLoading}>
              {eventsLoading ? t('loading') : eventsError ? t('retryPlay') : isPlaying ? t('stop') : t('play')}
            </button>
          )}
          {mintState === 'queued' || mintState === 'success' ? (
            <span>{mintState === 'queued' ? t('minting') : t('submitted')}</span>
          ) : (
            <button className="me-archive-row__mint" type="button"
              disabled={selfMintBusy}
              aria-label={t('mintLabel', { title })}
              onClick={() => {
                if (archiveMint.chainId === 1 || archiveMint.chainId === 11155111) {
                  void prepareEthereumMint();
                } else void mint(recording.pendingScoreId!);
              }}>
              {selfMintBusy ? t('creatingOrder') : mintState === 'error' ? t('retryMint') : t('mint')} <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}
