'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { useMeArchive, type ArchiveSlice } from '@/src/hooks/me/useMeArchive';
import { useOwnedEchoes } from '@/src/hooks/me/useOwnedEchoes';
import ArchiveEmpty from './ArchiveEmpty';
import ArchiveHeader from './ArchiveHeader';
import ArchiveSection from './ArchiveSection';
import MaterialArchiveRow from './MaterialArchiveRow';
import RecordingArchiveRow from './RecordingArchiveRow';
import ScoreArchiveRow from './ScoreArchiveRow';
import EchoArchiveRow from '@/src/components/echo/EchoArchiveRow';
import './archive.css';

type SectionId = 'records' | 'pending' | 'favorites';
const PAGE_SIZES: Record<SectionId, number> = { records: 3, pending: 3, favorites: 7 };

function countOf<T>(slice: ArchiveSlice<T>): number | null {
  return slice.resolved || slice.phase === 'error' || slice.items.length > 0
    ? slice.items.length : null;
}

function isLoading<T>(slice: ArchiveSlice<T>): boolean {
  return slice.phase === 'idle' || slice.phase === 'loading';
}

function pagesFor(count: number | null, size: number): number {
  return Math.max(1, Math.ceil((count ?? 0) / size));
}

/** 唱片、待铸造和收藏共用的数据视图；页面外壳可以替换，档案行为保持一致。 */
export default function MeArchivePage({ variant = 'default', onPrepared }: {
  variant?: 'default' | 'pond';
  onPrepared?: (ready: boolean) => void;
}) {
  const auth = useAuth();
  const { ownerId, scores, recordings, materials, retry } = useMeArchive({
    authenticated: auth.authenticated,
    authSource: auth.authSource,
    userId: auth.userId,
    getAccessToken: auth.getAccessToken,
  });
  const echoes = useOwnedEchoes({
    authenticated: auth.authenticated,
    authSource: auth.authSource,
    userId: auth.userId,
    evmAddress: auth.evmAddress,
    getAccessToken: auth.getAccessToken,
  });
  const [pages, setPages] = useState<Record<SectionId, number>>({
    records: 0, pending: 0, favorites: 0,
  });
  const archiveReady = Boolean(auth.userId && ownerId === auth.userId);
  const identityPending = !auth.ready || (auth.authenticated && !archiveReady);
  const authState = identityPending ? 'checking' as const
    : auth.authenticated ? 'authenticated' as const : 'unauthenticated' as const;

  const echoSettled = !auth.evmAddress || echoes.resolved || echoes.phase === 'error';
  const recordsSettled = (scores.resolved || scores.phase === 'error') && echoSettled;
  const prepared = auth.ready && (!auth.authenticated || (archiveReady && recordsSettled
    && (recordings.resolved || recordings.phase === 'error')
    && (materials.resolved || materials.phase === 'error')));
  useEffect(() => { onPrepared?.(prepared); }, [onPrepared, prepared]);
  useEffect(() => () => { onPrepared?.(false); }, [onPrepared]);
  const recordItems = [
    ...scores.items.map((item) => ({ kind: 'score' as const, key: `score-${item.queueId}`, item })),
    ...echoes.items.map((item) => ({ kind: 'echo' as const, key: `echo-${item.key}`, item })),
  ];
  const recordCount = recordItems.length > 0 || recordsSettled ? recordItems.length : null;
  const pendingCount = countOf(recordings);
  const favoriteCount = countOf(materials);
  const pageCounts = {
    records: pagesFor(recordCount, PAGE_SIZES.records),
    pending: pagesFor(pendingCount, PAGE_SIZES.pending),
    favorites: pagesFor(favoriteCount, PAGE_SIZES.favorites),
  };
  const safePages = {
    records: Math.min(pages.records, pageCounts.records - 1),
    pending: Math.min(pages.pending, pageCounts.pending - 1),
    favorites: Math.min(pages.favorites, pageCounts.favorites - 1),
  };
  const changePage = (section: SectionId, page: number) => {
    setPages((current) => ({ ...current, [section]: page }));
  };
  const refreshRecordings = () => {
    void retry('recordings');
    void retry('scores');
  };
  const recordStart = safePages.records * PAGE_SIZES.records;
  const pendingStart = safePages.pending * PAGE_SIZES.pending;
  const favoriteStart = safePages.favorites * PAGE_SIZES.favorites;

  return (
    <main className="me-archive" data-p11-theme="archive" data-me-variant={variant}
      data-archive-prepared={prepared}>
      <div className="me-archive__inner">
        <ArchiveHeader authState={authState} authSource={auth.authSource} evmAddress={auth.evmAddress} />
        {identityPending ? (
          <ArchiveEmpty title="正在确认你的档案" description="身份确认后，你的音乐会立即出现。" />
        ) : !auth.authenticated ? (
          <ArchiveEmpty title="登录后找回你的音乐" description="登录用于找回你的私人音乐档案。"
            action={<button type="button" onClick={auth.openLoginModal}>登录</button>} />
        ) : (
          <div className="me-archive__dashboard">
            <div className="me-archive__panel me-archive__panel--records" id="pond-echoes">
              <ArchiveSection id="records" title="我的唱片" count={recordCount}
                loading={isLoading(scores) || (Boolean(auth.evmAddress)
                  && (echoes.phase === 'idle' || echoes.phase === 'loading'))}
                error={[scores.error, echoes.error].filter(Boolean).join('；') || null}
                warning={echoes.warning} onRetry={() => { void retry('scores'); void echoes.retry(); }}
                emptyDescription="铸造完成的唱片会留在这里。"
                page={safePages.records} pageCount={pageCounts.records}
                onPageChange={(page) => changePage('records', page)}>
                {recordItems.slice(recordStart, recordStart + PAGE_SIZES.records).map((row, index) => (
                  row.kind === 'score'
                    ? <ScoreArchiveRow key={row.key} score={row.item} index={recordStart + index} />
                    : <EchoArchiveRow key={row.key} echo={row.item} index={recordStart + index} />
                ))}
                {(recordCount ?? 0) === 0 && !recordsSettled && <div className="me-archive__skeleton" />}
              </ArchiveSection>
            </div>

            <div className="me-archive__panel me-archive__panel--pending">
              <ArchiveSection id="pending" title="待铸造" count={pendingCount}
                loading={isLoading(recordings)} refreshing={recordings.phase === 'refreshing'}
                error={recordings.error} onRetry={() => { void retry('recordings'); }}
                emptyDescription="新录音会在这里保留 24 小时。"
                page={safePages.pending} pageCount={pageCounts.pending}
                onPageChange={(page) => changePage('pending', page)}>
                {recordings.items.slice(pendingStart, pendingStart + PAGE_SIZES.pending).map((recording, index) => (
                  <RecordingArchiveRow key={recording.key} recording={recording}
                    index={pendingStart + index} onQueued={refreshRecordings} />
                ))}
                {isLoading(recordings) && (pendingCount ?? 0) === 0 && <div className="me-archive__skeleton" />}
              </ArchiveSection>
            </div>

            <div className="me-archive__panel me-archive__panel--favorites">
              <ArchiveSection id="favorites" title="收藏" count={favoriteCount}
                loading={isLoading(materials)} error={materials.error}
                warning={materials.cached ? '正在更新…' : null}
                onRetry={() => { void retry('materials'); }}
                emptyDescription="收藏的声音会留在这里。"
                page={safePages.favorites} pageCount={pageCounts.favorites}
                onPageChange={(page) => changePage('favorites', page)}>
                {materials.items.slice(favoriteStart, favoriteStart + PAGE_SIZES.favorites).map((nft) => (
                  <MaterialArchiveRow key={nft.tx_hash || `pending-${nft.token_id}`} nft={nft} />
                ))}
                {isLoading(materials) && (favoriteCount ?? 0) === 0 && <div className="me-archive__skeleton" />}
              </ArchiveSection>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
