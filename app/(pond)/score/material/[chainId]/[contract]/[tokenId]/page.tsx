import { notFound } from 'next/navigation';
import { findOriginalTrackByAsset } from '@/src/lib/music-catalog/asset-registry';
import { normalizeContract, normalizeTokenId } from '@/src/lib/music-catalog/identity';
import '@/app/tracks/tracks.css';
export default async function MaterialPage({ params }: { params: Promise<{ chainId: string; contract: string; tokenId: string }> }) {
  const values = await params;
  let contract: string, token: string;
  try { contract = normalizeContract(values.contract); token = normalizeTokenId(values.tokenId); }
  catch { notFound(); }
  if (!/^(1|10)$/.test(values.chainId)) notFound();
  const track = findOriginalTrackByAsset(Number(values.chainId), contract, token);
  if (!track) notFound();
  return <div data-pond-tracks-route="true" data-original-track={track.trackId} />;
}
