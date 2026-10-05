import '@/app/tracks/tracks.css';
import '@/app/tracks/tracks-pond.css';

export const metadata = { title: '曲目 — Ripples in the Pond', description: '聆听35首原曲，查看永久来源与链上收藏凭证。' };

export default function PondTracksPage() {
  return <div data-pond-tracks-route="true" />;
}
