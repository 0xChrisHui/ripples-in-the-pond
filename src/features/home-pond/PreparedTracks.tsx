'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import TrackCatalog from '@/src/components/music-catalog/TrackCatalog';
import { initialTrackForView } from '@/src/lib/music-catalog/experience/route-selection';
import { findOriginalTrackByAsset } from '@/src/lib/music-catalog/asset-registry';
import PondRouteLink from '@/src/components/pond-shell/PondRouteLink';
import '@/app/tracks/tracks.css';
import '@/app/tracks/tracks-pond.css';

/** 首次进入后保留曲目、运动和颜色；仅上层可见性随路由改变。 */
export default function PreparedTracks() {
  const params = useSearchParams();
  const pathname = usePathname();
  const asset = pathname.match(/^\/score\/material\/(1|10)\/(0x[0-9a-fA-F]{40})\/(\d+)$/);
  const single = pathname.startsWith('/score/material/');
  const original = asset ? findOriginalTrackByAsset(Number(asset[1]), asset[2], asset[3]) : null;
  const track = pathname === '/tracks' || pathname === '/tracks/pond' ? params.get('track') ?? undefined : undefined;
  if (single && !original) return <main className="material-catalog" data-track-surface="pond">
    <h1>原曲不存在</h1><PondRouteLink href="/tracks">返回曲目</PondRouteLink>
  </main>;
  return <TrackCatalog initialTrackId={original?.trackId ?? initialTrackForView({ track })} single={single} appearance="pond" />;
}
