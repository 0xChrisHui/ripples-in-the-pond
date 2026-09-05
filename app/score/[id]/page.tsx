import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getScoreById } from '@/src/data/score-source';
import type { ScorePageData } from '@/src/data/score-source';
import FallbackShell from './FallbackShell';
import ScoreLifecycle from './components/ScoreLifecycle';
import ScorePondScene from './components/ScorePondScene';
import './score-page.css';

type Props = { params: Promise<{ id: string }> };

function networkLabel(): string {
  return process.env.NEXT_PUBLIC_CHAIN_ID === '10' ? 'OP Mainnet' : 'OP Sepolia';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const score = await getScoreById(id);
    if (!score) return { title: '作品暂不可用 · Ripples in the Pond' };
    const edition = score.tokenId == null ? '制作中的唱片' : `Ripples #${score.tokenId}`;
    const count = score.eventCount == null ? '一段' : `${score.eventCount} 个音符构成的`;
    const canonical = score.tokenId == null ? undefined : `/score/${score.tokenId}`;
    return {
      title: `${edition} — ${score.trackTitle}`,
      description: `${count}即兴演奏 · Ripples in the Pond`,
      alternates: canonical ? { canonical } : undefined,
      robots: score.state === 'ready' ? undefined : { index: false, follow: false },
      openGraph: {
        title: edition,
        description: `在“${score.trackTitle}”上的即兴演奏`,
        type: 'music.song',
        url: canonical,
      },
      twitter: { card: 'summary_large_image' },
    };
  } catch (error) {
    console.error('[score-page] metadata unavailable:', id, error);
    return { title: '作品暂不可用 · Ripples in the Pond' };
  }
}

export default async function ScorePage({ params }: Props) {
  const { id } = await params;
  let score: ScorePageData | null;
  try {
    score = await getScoreById(id);
  } catch (error) {
    console.error('[score-page] score unavailable:', id, error);
    return <FallbackShell />;
  }
  if (!score) notFound();
  if (score.state === 'ready') {
    return <ScorePondScene score={score} network={networkLabel()} />;
  }
  return <ScoreLifecycle score={score} network={networkLabel()} />;
}
