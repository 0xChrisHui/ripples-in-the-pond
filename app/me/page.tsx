'use client';

import { useState } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { useMeArchive, type ArchiveSlice } from '@/src/hooks/me/useMeArchive';
import { useOwnedEchoes } from '@/src/hooks/me/useOwnedEchoes';
import ArchiveEmpty from '@/src/components/me/archive/ArchiveEmpty';
import ArchiveHeader from '@/src/components/me/archive/ArchiveHeader';
import ArchiveSection from '@/src/components/me/archive/ArchiveSection';
import MaterialArchiveRow from '@/src/components/me/archive/MaterialArchiveRow';
import RecordingArchiveRow from '@/src/components/me/archive/RecordingArchiveRow';
import ScoreArchiveRow from '@/src/components/me/archive/ScoreArchiveRow';
import EchoArchiveRow from '@/src/components/echo/EchoArchiveRow';
import '@/src/components/me/archive/archive.css';

type SectionId = 'records' | 'pending' | 'favorites';
const PAGE_SIZE = 6;

function countOf<T>(slice: ArchiveSlice<T>): number | null {
  return slice.resolved || slice.phase === 'error' || slice.items.length > 0
    ? slice.items.length : null;
}

function isLoading<T>(slice: ArchiveSlice<T>): boolean {
  return slice.phase === 'idle' || slice.phase === 'loading';
}

/** `/me` 私人音乐档案：桌面用目录选择内容，手机保持同一阅读顺序。 */
export default function MePage() {
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
  const [selectedSection, setSelectedSection] = useState<SectionId | null>(null);
  const [page, setPage] = useState(0);
  const archiveReady = Boolean(auth.userId && ownerId === auth.userId);
  const identityPending = !auth.ready || (auth.authenticated && !archiveReady);
  const authState = identityPending ? 'checking' as const
    : auth.authenticated ? 'authenticated' as const : 'unauthenticated' as const;

  const echoSettled = echoes.phase === 'ready' || echoes.phase === 'error';
  const recordsSettled = (scores.resolved || scores.phase === 'error') && echoSettled;
  const recordItems = [
    ...scores.items.map((item) => ({ kind: 'score' as const, key: `score-${item.queueId}`, item })),
    ...echoes.items.map((item) => ({ kind: 'echo' as const, key: `echo-${item.key}`, item })),
  ];
  const recordCount = recordItems.length > 0 || recordsSettled ? recordItems.length : null;
  const pendingCount = countOf(recordings);
  const favoriteCount = countOf(materials);

  const defaultSection: SectionId = recordCount === 0 && (pendingCount ?? 0) > 0
    ? 'pending'
    : recordCount === 0 && pendingCount === 0 && (favoriteCount ?? 0) > 0
      ? 'favorites' : 'records';
  const active = selectedSection ?? defaultSection;

  const navItems: Array<{ id: SectionId; label: string; note: string; count: number | null }> = [
    { id: 'records', label: '我的唱片', note: '永久作品与制作进度', count: recordCount },
    { id: 'pending', label: '待铸造', note: '24 小时内完成铸造', count: pendingCount },
    { id: 'favorites', label: '收藏', note: '收藏的声音', count: favoriteCount },
  ];
  const activeMeta = navItems.find((item) => item.id === active)!;
  const activeTotal = activeMeta.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(activeTotal / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const selectSection = (id: SectionId) => {
    setSelectedSection(id);
    setPage(0);
  };
  const refreshRecordings = () => {
    void retry('recordings');
    void retry('scores');
  };

  let loading = false;
  let error: string | null = null;
  let warning: string | null = null;
  let emptyDescription = '';
  let rows = null;
  if (active === 'records') {
    loading = isLoading(scores) || echoes.phase === 'idle' || echoes.phase === 'loading';
    error = [scores.error, echoes.error].filter(Boolean).join('；') || null;
    warning = echoes.warning;
    emptyDescription = '待铸造的录音提交后，会在这里成为永久唱片。';
    rows = recordItems.slice(start, start + PAGE_SIZE).map((row, index) => row.kind === 'score'
      ? <ScoreArchiveRow key={row.key} score={row.item} index={start + index} />
      : <EchoArchiveRow key={row.key} echo={row.item} index={start + index} />);
  } else if (active === 'pending') {
    loading = isLoading(recordings);
    error = recordings.error;
    emptyDescription = '回到池塘加入一次演奏，录音会在这里保留 24 小时。';
    rows = recordings.items.slice(start, start + PAGE_SIZE).map((recording, index) => (
      <RecordingArchiveRow key={recording.key} recording={recording}
        index={start + index} onQueued={refreshRecordings} />
    ));
  } else {
    loading = isLoading(materials);
    error = materials.error;
    warning = materials.cached ? '正在后台更新收藏…' : null;
    emptyDescription = '在池塘里收藏喜欢的声音，它们会留在这里。';
    rows = materials.items.slice(start, start + PAGE_SIZE).map((nft, index) => (
      <MaterialArchiveRow key={nft.tx_hash || `pending-${nft.token_id}`}
        nft={nft} index={start + index} />
    ));
  }

  return (
    <main className="me-archive" data-p11-theme="archive">
      <div className="me-archive__inner">
        <ArchiveHeader authState={authState} authSource={auth.authSource} evmAddress={auth.evmAddress} />
        {identityPending ? (
          <ArchiveEmpty title="正在确认你的档案" description="身份确认后，你的唱片与收藏会分别刷新。" />
        ) : !auth.authenticated ? (
          <ArchiveEmpty title="登录后找回你的音乐" description="登录用于找回你的私人音乐档案。"
            action={<button type="button" onClick={auth.openLoginModal}>登录</button>} />
        ) : (
          <div className="me-archive__workspace">
            <aside className="me-archive__rail">
              <div className="me-archive__intro">
                <p className="me-archive__kicker">PRIVATE ARCHIVE</p>
                <h1>我的音乐档案</h1>
                <p>被保存的声音，按它们的下一步去向留在这里。</p>
              </div>
              <nav className="me-archive__index" aria-label="音乐档案目录">
                {navItems.map((item) => (
                  <button key={item.id} type="button" data-active={active === item.id || undefined}
                    aria-pressed={active === item.id} onClick={() => selectSection(item.id)}>
                    <span><strong>{item.label}</strong><small>{item.note}</small></span>
                    {item.count != null && item.count > 0 && <b>{item.count}</b>}
                  </button>
                ))}
              </nav>
            </aside>
            <div className="me-archive__content" id="pond-echoes">
              <ArchiveSection title={activeMeta.label} count={activeMeta.count} loading={loading}
                error={error} warning={warning} onRetry={() => {
                  if (active === 'records') { void retry('scores'); void echoes.retry(); }
                  else void retry(active === 'pending' ? 'recordings' : 'materials');
                }} emptyDescription={emptyDescription} page={safePage} pageCount={pageCount} onPageChange={setPage}>
                {rows}
                {loading && activeTotal === 0 && <div className="me-archive__skeleton" />}
              </ArchiveSection>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
