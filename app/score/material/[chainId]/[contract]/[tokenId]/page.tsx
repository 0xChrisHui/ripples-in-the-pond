import { notFound } from 'next/navigation';
import { getMusicCatalog } from '@/src/lib/music-catalog/asset-registry';
import { normalizeContract, normalizeTokenId } from '@/src/lib/music-catalog/identity';
import TrackCatalog from '@/src/components/music-catalog/TrackCatalog';
import '@/app/tracks/tracks.css';
export default async function MaterialPage({ params }: { params: Promise<{ chainId: string; contract: string; tokenId: string }> }) {
  const values = await params;
  let contract: string, token: string;
  try { contract = normalizeContract(values.contract); token = normalizeTokenId(values.tokenId); }
  catch { notFound(); }
  if (!/^(1|10)$/.test(values.chainId)) notFound();
  const track = getMusicCatalog().tracks.find((item) => item.deployments.some((deployment) => deployment.chainId === Number(values.chainId)
    && deployment.contractAddress === contract && deployment.tokenId === token && deployment.status !== 'undeployed'));
  if (!track) notFound();
  return <TrackCatalog initialTrackId={track.trackId} single />;
}
