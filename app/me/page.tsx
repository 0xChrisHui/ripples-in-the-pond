'use client';

import { useAuth } from '@/src/hooks/useAuth';
import { useMeArchive, type ArchiveSlice } from '@/src/hooks/me/useMeArchive';
import ArchiveEmpty from '@/src/components/me/archive/ArchiveEmpty';
import ArchiveHeader from '@/src/components/me/archive/ArchiveHeader';
import ArchiveSection from '@/src/components/me/archive/ArchiveSection';
import MaterialArchiveRow from '@/src/components/me/archive/MaterialArchiveRow';
import RecordingArchiveRow from '@/src/components/me/archive/RecordingArchiveRow';
import ScoreArchiveRow from '@/src/components/me/archive/ScoreArchiveRow';
import '@/src/components/me/archive/archive.css';

function countOf<T>(slice: ArchiveSlice<T>): number | null {
  return slice.resolved || slice.items.length > 0 ? slice.items.length : null;
}

function isLoading<T>(slice: ArchiveSlice<T>): boolean {
  return slice.phase === 'idle' || slice.phase === 'loading';
}

/** `/me` 私人音乐档案：唱片、录音、素材各守住自己的真实状态与故障边界。 */
export default function MePage() {
  const auth = useAuth();
  const { ownerId, scores, recordings, materials, retry } = useMeArchive({
    authenticated: auth.authenticated,
    userId: auth.userId,
    getAccessToken: auth.getAccessToken,
  });
  const archiveReady = Boolean(auth.userId && ownerId === auth.userId);
  const identityPending = !auth.ready || (auth.authenticated && !archiveReady);
  const authState = identityPending
    ? 'checking' as const
    : auth.authenticated
      ? 'authenticated' as const
      : 'unauthenticated' as const;
  const counts = [
    { label: '我的唱片', value: countOf(scores) },
    { label: '我的录音', value: countOf(recordings) },
    { label: '我的素材', value: countOf(materials) },
  ];
  const refreshAfterMint = () => {
    void retry('scores');
    void retry('recordings');
  };

  return (
    <main className="me-archive" data-p11-theme="archive">
      <div className="me-archive__inner">
        <ArchiveHeader
          authState={authState}
          authSource={auth.authSource}
          evmAddress={auth.evmAddress}
          counts={auth.authenticated && archiveReady ? counts : undefined}
        />

        {identityPending ? (
          <ArchiveEmpty
            eyebrow="IDENTITY CHECK"
            title="正在确认你的档案"
            description="正在读取登录身份；确认完成后会分别刷新唱片、录音与素材。"
          />
        ) : !auth.authenticated ? (
          <ArchiveEmpty
            eyebrow="PRIVATE ARCHIVE"
            title="登录后找回你的音乐"
            description="登录用于找回你的音乐档案，并继续保存属于你的声音。"
            action={<button type="button" onClick={auth.openLoginModal}>登录</button>}
          />
        ) : (
          <div className="me-archive__sections">
            <ArchiveSection
              index={1} title="我的唱片" count={countOf(scores)}
              loading={isLoading(scores)} refreshing={scores.phase === 'refreshing'}
              error={scores.error} onRetry={() => { void retry('scores'); }}
              emptyDescription="录音进入制作后，会在这里成为一条唱片记录。"
            >
              {scores.items.map((score, index) => (
                <ScoreArchiveRow key={score.queueId} score={score} index={index} />
              ))}
              {isLoading(scores) && scores.items.length === 0 && <div className="me-archive__skeleton" />}
            </ArchiveSection>

            <ArchiveSection
              index={2} title="我的录音" count={countOf(recordings)}
              loading={isLoading(recordings)} refreshing={recordings.phase === 'refreshing'}
              error={recordings.error} onRetry={() => { void retry('recordings'); }}
              emptyDescription="回到池塘播放一首音乐，你加入的演奏会先保存在这里。"
            >
              {recordings.items.map((recording, index) => (
                <RecordingArchiveRow key={recording.key} recording={recording}
                  index={index} onQueued={refreshAfterMint} />
              ))}
              {isLoading(recordings) && recordings.items.length === 0 && <div className="me-archive__skeleton" />}
            </ArchiveSection>

            <ArchiveSection
              index={3} title="我的素材" count={countOf(materials)}
              loading={isLoading(materials)} refreshing={materials.phase === 'refreshing'}
              error={materials.error} onRetry={() => { void retry('materials'); }}
              emptyDescription="聆听音乐时，可以将喜欢的声音素材加入收藏。"
            >
              {materials.items.map((nft, index) => (
                <MaterialArchiveRow key={nft.tx_hash || `pending-${nft.token_id}`}
                  nft={nft} index={index} />
              ))}
              {isLoading(materials) && materials.items.length === 0 && <div className="me-archive__skeleton" />}
            </ArchiveSection>
          </div>
        )}
      </div>
    </main>
  );
}
