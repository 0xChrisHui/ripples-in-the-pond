import TrackCatalog from '@/src/components/music-catalog/TrackCatalog';
import { initialTrackForView, type TrackSearchParams } from '@/src/lib/music-catalog/experience/route-selection';
import '../tracks.css';
export const metadata = { title: '曲目 — Ripples in the Pond', description: '聆听35首原曲，查看永久来源与链上收藏凭证。' };
export default async function TracksPage({ searchParams }: { searchParams: Promise<TrackSearchParams> }) {
  return <TrackCatalog appearance="archive" initialTrackId={initialTrackForView(await searchParams)} />;
}
