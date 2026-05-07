import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getScoreById } from '@/src/data/score-source';
import ScorePlayer from './ScorePlayer';

/**
 * /score/[id] — ScoreNFT 公开回放页（B8 重设：路由 ID 兼容 tokenId / queue.id UUID）
 *
 * 任何人可访问，无需登录。已上链的链上信息显示，未上链时只显示"上链中"占位。
 * 播放走前端 inline ScorePlayer（不依赖 Arweave decoder iframe）。
 */

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const score = await getScoreById(id);
  if (!score) return { title: 'Score Not Found' };

  const title = score.tokenId
    ? `Ripples #${score.tokenId} — ${score.trackTitle}`
    : `Ripples · 上链中 — ${score.trackTitle}`;

  return {
    title,
    description: `${score.eventCount} 个音符的即兴演奏`,
    openGraph: {
      title: score.tokenId ? `Ripples #${score.tokenId}` : 'Ripples · 上链中',
      description: `在 "${score.trackTitle}" 上的即兴演奏`,
      type: 'music.song',
      url: `/score/${score.id}`,
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function ScorePage({ params }: Props) {
  const { id } = await params;
  const score = await getScoreById(id);
  if (!score) notFound();

  const shortAddr = score.creatorAddress
    ? `${score.creatorAddress.slice(0, 6)}...${score.creatorAddress.slice(-4)}`
    : '';
  const title = score.tokenId ? `Ripples #${score.tokenId}` : 'Ripples · 上链中';
  const contractAddr = process.env.NEXT_PUBLIC_SCORE_NFT_ADDRESS;

  return (
    <main className="min-h-screen bg-black px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Link
          href="/"
          className="mb-8 inline-block text-xs text-white/30 hover:text-white/50"
        >
          &larr; Ripples in the Pond
        </Link>

        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={score.coverUrl}
            alt={`${title} cover`}
            width={280}
            height={280}
            className="mx-auto mb-6 rounded-lg"
          />
          <h1 className="text-xl font-light tracking-widest text-white/90">
            {title}
          </h1>
          <p className="mt-1 text-sm text-white/50">{score.trackTitle}</p>
          {shortAddr && (
            <p className="mt-1 font-mono text-xs text-white/30">{shortAddr}</p>
          )}
        </div>

        <ScorePlayer
          track={score.track}
          events={score.events}
          eventCount={score.eventCount}
        />

        <section className="mt-8 space-y-2 border-t border-white/10 pt-6 font-mono text-xs text-white/30">
          {score.tokenId != null && (
            <InfoRow label="Token ID" value={`#${score.tokenId}`} />
          )}
          <InfoRow label="Events" value={String(score.eventCount)} />
          <InfoRow
            label="Minted"
            value={new Date(score.mintedAt).toLocaleDateString()}
          />
          {score.txHash && score.etherscanUrl && (
            <div className="flex justify-between">
              <span>Tx</span>
              <a
                href={score.etherscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate pl-4 text-white/50 hover:text-white/70"
              >
                {score.txHash.slice(0, 10)}...{score.txHash.slice(-6)}
              </a>
            </div>
          )}
          {contractAddr && score.tokenId != null && (
            <div className="flex justify-between">
              <span>Contract</span>
              <a
                href={`https://sepolia-optimism.etherscan.io/address/${contractAddr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate pl-4 text-white/50 hover:text-white/70"
              >
                {contractAddr.slice(0, 10)}...
              </a>
            </div>
          )}
          {score.tokenId == null && (
            <p className="text-white/30">链上信息生成中，稍后刷新查看</p>
          )}
        </section>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="text-white/50">{value}</span>
    </div>
  );
}
