import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMultichainScore } from '@/src/data/score/multichain';
import { buildScoreRoute, getChainDefinition } from '@/src/lib/chain/multichain/registry';
import ScoreLifecycle from '../../components/ScoreLifecycle';
import ScorePondScene from '../../components/ScorePondScene';

type Props = { params: Promise<{ id: string; contract: string; tokenId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, contract, tokenId } = await params;
  try {
    const score = await getMultichainScore(id, contract, tokenId);
    if (!score) return { title: '作品不存在 · Ripples in the Pond', robots: { index: false } };
    const canonical = buildScoreRoute(score.chainId, score.contractAddress, score.tokenId!);
    const count = score.eventCount == null ? '一段永久' : `${score.eventCount} 个音符构成的`;
    return {
      title: `Ripples #${score.tokenId} — ${score.trackTitle}`,
      description: `${count}即兴演奏 · ${getChainDefinition(score.chainId).displayName}`,
      alternates: { canonical },
      openGraph: {
        title: `Ripples #${score.tokenId}`,
        description: `在“${score.trackTitle}”上的即兴演奏`,
        type: 'music.song',
        url: canonical,
      },
      twitter: { card: 'summary_large_image' },
    };
  } catch (error) {
    console.error('[multichain-score] metadata unavailable:', id, contract, tokenId, error);
    return { title: '作品暂不可用 · Ripples in the Pond', robots: { index: false } };
  }
}

export default async function MultichainScorePage({ params }: Props) {
  const { id, contract, tokenId } = await params;
  const score = await getMultichainScore(id, contract, tokenId);
  if (!score) notFound();
  const network = getChainDefinition(score.chainId).displayName;
  return score.state === 'ready'
    ? <ScorePondScene score={score} network={network} />
    : <ScoreLifecycle score={score} network={network} />;
}
