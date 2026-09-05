import type { Metadata } from 'next';
import Link from 'next/link';
import ArtistPortrait from '@/src/components/artist/ArtistPortrait';
import ArtistStatement from '@/src/components/artist/ArtistStatement';
import Project108 from '@/src/components/artist/Project108';
import { artistContent } from '@/src/content/artist';
import { supabaseAdmin } from '@/src/lib/supabase';
import './artist.css';

export const metadata: Metadata = {
  title: '艺术家 — Ripples in the Pond',
  description: 'Ripples in the Pond 的艺术家文字肖像与 108 首长期作品实践。',
};

async function readPublished(): Promise<number> {
  const { count, error } = await supabaseAdmin.from('tracks')
    .select('id', { count: 'exact', head: true }).eq('published', true);
  if (error || count === null) throw new Error(error?.message ?? '缺少已发布作品数');
  return count;
}

async function readTotalMints(): Promise<number> {
  const [material, score] = await Promise.all([
    supabaseAdmin.from('mint_events').select('id', { count: 'exact', head: true })
      .is('score_nft_token_id', null),
    supabaseAdmin.from('score_nft_queue').select('id', { count: 'exact', head: true })
      .eq('status', 'success'),
  ]);
  if (material.error || score.error || material.count === null || score.count === null) {
    throw new Error(material.error?.message ?? score.error?.message ?? '缺少铸造总数');
  }
  return material.count + score.count;
}

async function readParticipants(): Promise<number> {
  const [material, score] = await Promise.all([
    supabaseAdmin.from('mint_events').select('user_id'),
    supabaseAdmin.from('score_nft_queue').select('user_id').eq('status', 'success'),
  ]);
  if (material.error || score.error || !material.data || !score.data) {
    throw new Error(material.error?.message ?? score.error?.message ?? '缺少参与者数据');
  }
  const ids = [...material.data, ...score.data]
    .map((row) => row.user_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  return new Set(ids).size;
}

function nullableResult<T>(label: string, result: PromiseSettledResult<T>): T | null {
  if (result.status === 'fulfilled') return result.value;
  console.error(`/artist ${label} 查询失败：`, result.reason);
  return null;
}

async function getArtistStats() {
  const [published, totalMints, participants] = await Promise.allSettled([
    readPublished(), readTotalMints(), readParticipants(),
  ]);
  return {
    published: nullableResult('已发布作品', published),
    totalMints: nullableResult('铸造总数', totalMints),
    participants: nullableResult('参与者', participants),
  };
}

export default async function ArtistPage() {
  const stats = await getArtistStats();

  return (
    <main className="artist-page" data-p11-theme="archive">
      <div className="artist-page__shell">
        <nav className="artist-page__nav" aria-label="页面导航">
          <Link href="/">Ripples in the Pond</Link>
          <span>ARTIST / 001</span>
        </nav>
        <ArtistPortrait content={artistContent} />
        <div className="artist-page__waterline" aria-hidden="true"><span /></div>
        <ArtistStatement statement={artistContent.statement} />
        <Project108 description={artistContent.project108} {...stats} />
        <footer className="artist-page__footer">
          <span>RIPPLES IN THE POND</span><span>001—108</span>
        </footer>
      </div>
    </main>
  );
}
