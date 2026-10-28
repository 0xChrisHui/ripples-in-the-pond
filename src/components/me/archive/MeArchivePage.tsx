'use client';

import { useEffect, useLayoutEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/src/hooks/useAuth';
import { useTranslations } from 'next-intl';
import { useMsg } from '@/src/i18n/msg';
import { useServerText } from '@/src/i18n/use-server-text';
import { useMeArchive } from '@/src/hooks/me/useMeArchive';
import { useOwnedEchoes } from '@/src/hooks/me/useOwnedEchoes';
import { useScoreRoutePreload } from '@/src/hooks/me/useScoreRoutePreload';
import { archiveCount, archiveLoading } from '@/src/hooks/me/archive-state';
import { ARCHIVE_PAGE_SIZES, useArchivePagination } from '@/src/hooks/me/archive/useArchivePagination';
import ArchiveEmpty from './ArchiveEmpty';
import PageNavigation from '@/src/components/pond-shell/navigation/PageNavigation';
import ArchiveSection from './ArchiveSection';
import MaterialArchiveRow from './MaterialArchiveRow';
import RecordingArchiveRow from './RecordingArchiveRow';
import ScoreArchiveRow from './ScoreArchiveRow';
import EchoArchiveRow from '@/src/components/echo/EchoArchiveRow';
import ArchiveMintProvider, { ArchiveMintNetworkControl } from '@/src/components/mint/archive/ArchiveMintProvider';
import { useScoreOrigin } from '@/src/components/pond-shell/score/score-origin';
import { usePondTransition } from '@/src/components/pond-shell/pond-transition';
import MintHistorySection from './MintHistorySection';
import { MINT_RECORDED_EVENT } from '@/src/lib/mint-notice';
import './archive.css';

/** 唱片、待铸造和收藏共用的数据视图；页面外壳可以替换，档案行为保持一致。 */
export default function MeArchivePage({ variant = 'default', onPrepared }: {
  variant?: 'default' | 'pond'; onPrepared?: (ready: boolean) => void;
}) {
  const pathname = usePathname();
  const scoreOrigin = useScoreOrigin();
  const transition = usePondTransition();
  const auth = useAuth();
  const t = useTranslations('me'), ta = useTranslations('account');
  const msgText = useMsg(), serverText = useServerText();
  const { ownerId, scores, recordings, materials, retry } = useMeArchive({
    authenticated: auth.authenticated,
    authSource: auth.authSource,
    userId: auth.userId,
    getAccessToken: auth.getAccessToken,
  });
  useScoreRoutePreload(pathname === '/me', scores.items);
  const echoes = useOwnedEchoes({
    authenticated: auth.authenticated,
    authSource: auth.authSource,
    userId: auth.userId,
    evmAddress: auth.evmAddress,
    getAccessToken: auth.getAccessToken,
  });
  const recordsError = [scores.error, echoes.error].filter(Boolean).join('；') || null;
  const archiveReady = Boolean(auth.userId && ownerId === auth.userId);
  const identityPending = !auth.ready || (auth.authenticated && !archiveReady);
  const ownerKey = auth.authenticated && auth.authSource && auth.userId
    ? `${auth.authSource}:${auth.userId}:${auth.evmAddress?.toLowerCase() ?? ''}` : '';

  const echoSettled = !auth.evmAddress || echoes.resolved || echoes.phase === 'error';
  const recordsSettled = (scores.resolved || scores.phase === 'error') && echoSettled;
  const prepared = auth.ready && (!auth.authenticated || (archiveReady && recordsSettled
    && (recordings.resolved || recordings.phase === 'error')
    && (materials.resolved || materials.phase === 'error')));
  useEffect(() => {
    const events = [['jam:draft-saved', 'recordings'], [MINT_RECORDED_EVENT, 'materials']] as const;
    const handlers = events.map(([name, section]) => [name, () => { void retry(section); }] as const);
    handlers.forEach(([name, handler]) => window.addEventListener(name, handler));
    return () => handlers.forEach(([name, handler]) => window.removeEventListener(name, handler));
  }, [retry]);
  useEffect(() => { onPrepared?.(prepared); }, [onPrepared, prepared]);
  useEffect(() => () => { onPrepared?.(false); }, [onPrepared]);
  const recordItems = useMemo(() => [
    ...scores.items.map((item) => ({ kind: 'score' as const, key: `score-${item.queueId}`, item })),
    ...echoes.items.map((item) => ({ kind: 'echo' as const, key: `echo-${item.key}`, item })),
  ], [echoes.items, scores.items]);
  const recordCount = recordItems.length > 0 || recordsSettled ? recordItems.length : null;
  const pendingCount = archiveCount(recordings);
  // 收藏按曲目合并：同一首无论在哪收藏、铸在哪条链，只显示一次（逐条来源见“铸造记录”）。
  const favoriteItems = useMemo(() => materials.items.filter((nft, index, all) => (
    !nft.track || all.findIndex((other) => other.track?.id === nft.track?.id) === index)), [materials.items]);
  const favoriteCount = materials.resolved || favoriteItems.length > 0 ? favoriteItems.length : archiveCount(materials);
  const pagination = useArchivePagination({ records: recordCount, pending: pendingCount,
    favorites: favoriteCount });
  const { pageCounts, safePages, starts, changePage, showRecordsPage } = pagination;
  useEffect(() => {
    const origin = scoreOrigin.origin;
    if (auth.ready && origin && origin.ownerKey !== ownerKey) scoreOrigin.clear(origin.id);
  }, [auth.ready, ownerKey, scoreOrigin]);
  useLayoutEffect(() => {
    const origin = scoreOrigin.origin;
    const transaction = transition?.transaction;
    const returning = transaction?.current === 'score' && transaction.target === 'archive'
      && transaction.stage === 'preparing';
    if (origin?.stage === 'score' && returning) {
      scoreOrigin.beginReturn(origin.id, false);
      return;
    }
    if (!origin || origin.stage !== 'returning' || !returning
      || !archiveReady || !recordsSettled) return;
    const index = recordItems.findIndex((row) => row.key === origin.key);
    if (index < 0) {
      document.querySelector<HTMLElement>('[data-pond-focus-entry]')?.focus({ preventScroll: true });
      transition?.reportVisualReady('archive', transaction.generation);
      return;
    }
    const targetPage = Math.floor(index / ARCHIVE_PAGE_SIZES.records);
    if (safePages.records !== targetPage) {
      const frame = requestAnimationFrame(() => {
        showRecordsPage(targetPage);
      });
      return () => cancelAnimationFrame(frame);
    }
    const frame = requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(
        `[data-score-origin-key="${CSS.escape(origin.key)}"]`,
      );
      window.scrollTo({ top: origin.scrollY, behavior: 'auto' });
      row?.querySelector<HTMLElement>('a[href]')?.focus({ preventScroll: true });
      transition?.reportVisualReady('archive', transaction.generation);
    });
    return () => cancelAnimationFrame(frame);
  }, [archiveReady, safePages.records, showRecordsPage,
    recordItems, recordsSettled, scoreOrigin, transition]);
  useEffect(() => {
    const transaction = transition?.transaction;
    const origin = scoreOrigin.origin;
    if (!origin || origin.stage !== 'returning' || pathname !== '/me'
      || transaction?.stage !== 'stable' || transaction.current !== 'archive') return;
    scoreOrigin.clear(origin.id);
  }, [pathname, scoreOrigin, transition?.transaction]);
  const refreshRecordings = () => {
    void retry('recordings');
    void retry('scores');
  };
  const { records: recordStart, pending: pendingStart, favorites: favoriteStart } = starts;
  return (
    <ArchiveMintProvider userId={auth.userId} walletCapability={auth.walletCapability}
      onOrderClosed={refreshRecordings}>
    <main className="me-archive" data-p11-theme="archive" data-me-variant={variant}
      data-archive-prepared={prepared} data-score-origin-stage={scoreOrigin.origin?.stage}>
      <div className="me-archive__inner">
        <PageNavigation />
        {identityPending ? (
          <ArchiveEmpty title={t('identityPendingTitle')} description={t('identityPendingDescription')} />
        ) : !auth.authenticated ? (
          <ArchiveEmpty title={t('signInTitle')} description={t('signInDescription')}
            action={<button type="button" onClick={auth.openLoginModal}>{ta('signIn')}</button>} />
        ) : (
          <div className="me-archive__dashboard">
            <div className="me-archive__panel me-archive__panel--records" id="pond-echoes">
              <ArchiveSection id="records" title={t('sections.records')} count={recordCount}
                loading={archiveLoading(scores) || (Boolean(auth.evmAddress)
                  && (echoes.phase === 'idle' || echoes.phase === 'loading'))}
                error={recordsError && serverText(recordsError, t('errors.records'))}
                warning={echoes.warning.map(msgText).join('；') || null} onRetry={() => { void retry('scores'); void echoes.retry(); }}
                emptyDescription={t('empty.records')}
                page={safePages.records} pageCount={pageCounts.records}
                onPageChange={(page) => changePage('records', page)}>
                {recordItems.slice(recordStart, recordStart + ARCHIVE_PAGE_SIZES.records).map((row, index) => (
                  row.kind === 'score'
                    ? <ScoreArchiveRow key={row.key} score={row.item} index={recordStart + index}
                      ownerKey={ownerKey} />
                    : <EchoArchiveRow key={row.key} echo={row.item} index={recordStart + index} />
                ))}
                {(recordCount ?? 0) === 0 && !recordsSettled && <div className="me-archive__skeleton" />}
              </ArchiveSection>
            </div>

            <div className="me-archive__panel me-archive__panel--pending">
              {auth.walletCapability.loginEntry === 'external_wallet' && <ArchiveMintNetworkControl />}
              <ArchiveSection id="pending" title={t('sections.pending')} count={pendingCount}
                loading={archiveLoading(recordings)} refreshing={recordings.phase === 'refreshing'}
                error={recordings.error && serverText(recordings.error, t('errors.pending'))} onRetry={() => { void retry('recordings'); }}
                emptyDescription={t('empty.pending')}
                page={safePages.pending} pageCount={pageCounts.pending}
                onPageChange={(page) => changePage('pending', page)}>
                {recordings.items.slice(pendingStart, pendingStart + ARCHIVE_PAGE_SIZES.pending).map((recording, index) => (
                  <RecordingArchiveRow key={recording.key} recording={recording}
                    index={pendingStart + index} onQueued={refreshRecordings} />
                ))}
                {archiveLoading(recordings) && (pendingCount ?? 0) === 0 && <div className="me-archive__skeleton" />}
              </ArchiveSection>
            </div>

            <div className="me-archive__panel me-archive__panel--favorites">
              <ArchiveSection id="favorites" title={t('sections.favorites')} count={favoriteCount}
                loading={archiveLoading(materials)} error={materials.error && serverText(materials.error, t('errors.favorites'))}
                checkingOwner={Boolean(materials.cached)}
                onRetry={() => { void retry('materials'); }}
                emptyDescription={t('empty.favorites')}
                page={safePages.favorites} pageCount={pageCounts.favorites}
                onPageChange={(page) => changePage('favorites', page)}>
                {favoriteItems.slice(favoriteStart, favoriteStart + ARCHIVE_PAGE_SIZES.favorites).map((nft) => (
                  <MaterialArchiveRow key={nft.id ?? (nft.tx_hash || `pending-${nft.token_id}`)} nft={nft} />
                ))}
                {archiveLoading(materials) && (favoriteCount ?? 0) === 0 && <div className="me-archive__skeleton" />}
              </ArchiveSection>
            </div>
            <MintHistorySection materials={materials.items} scores={scores.items}
              loading={archiveLoading(materials) || archiveLoading(scores)} />
          </div>
        )}
      </div>
    </main>
    </ArchiveMintProvider>
  );
}
