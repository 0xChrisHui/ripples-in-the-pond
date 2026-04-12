import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getScoreByTokenId } from '@/src/data/score-source';
import ScorePlayer from './ScorePlayer';

/**
 * /score/[tokenId] — ScoreNFT 公开回放页
 * 任何人可访问，无需登录。数据来自 DB 主路径。
 */

type Props = { params: Promise<{ tokenId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tokenId: raw } = await params;
  const id = Number(raw);
  if (!id || id < 1) return { title: 'Score Not Found' };

  const score = await getScoreByTokenId(id);
  if (!score) return { title: 'Score Not Found' };

  return {
    title: `Ripples #${score.tokenId} — ${score.trackTitle}`,
    description: `${score.eventCount} 个音符的即兴演奏，永久存储在 Arweave 上`,
    openGraph: {
      title: `Ripples #${score.tokenId}`,
      description: `在 "${score.trackTitle}" 上的即兴演奏`,
      type: 'music.song',
      url: `/score/${score.tokenId}`,
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function ScorePage({ params }: Props) {
  const { tokenId: raw } = await params;
  const id = Number(raw);
  if (!id || id < 1) notFound();

  const score = await getScoreByTokenId(id);
  if (!score) notFound();

  const shortAddr = `${score.creatorAddress.slice(0, 6)}...${score.creatorAddress.slice(-4)}`;

  return (
    <main className="min-h-screen bg-black px-4 py-10">
      <div className="mx-auto max-w-xl">
        {/* 顶部导航 */}
        <Link
          href="/"
          className="mb-8 inline-block text-xs text-white/30 hover:text-white/50"
        >
          &larr; Ripples in the Pond
        </Link>

        {/* 封面 + 标题 */}
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={score.coverUrl}
            alt={`Ripples #${score.tokenId} cover`}
            width={280}
            height={280}
            className="mx-auto mb-6 rounded-lg"
          />
          <h1 className="text-xl font-light tracking-widest text-white/90">
            Ripples #{score.tokenId}
          </h1>
          <p className="mt-1 text-sm text-white/50">{score.trackTitle}</p>
          <p className="mt-1 font-mono text-xs text-white/30">{shortAddr}</p>
        </div>

        {/* 播放器（iframe 嵌入 Arweave decoder） */}
        <ScorePlayer
          decoderUrl={score.decoderUrl}
          eventCount={score.eventCount}
        />

        {/* 链上信息 */}
        <section className="mt-8 space-y-2 border-t border-white/10 pt-6 font-mono text-xs text-white/30">
          <InfoRow label="Token ID" value={`#${score.tokenId}`} />
          <InfoRow label="Events" value={String(score.eventCount)} />
          <InfoRow
            label="Minted"
            value={new Date(score.mintedAt).toLocaleDateString()}
          />
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
          <div className="flex justify-between">
            <span>Contract</span>
            <a
              href={`https://sepolia-optimism.etherscan.io/address/${process.env.NEXT_PUBLIC_SCORE_NFT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate pl-4 text-white/50 hover:text-white/70"
            >
              {process.env.NEXT_PUBLIC_SCORE_NFT_ADDRESS?.slice(0, 10)}...
            </a>
          </div>
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
