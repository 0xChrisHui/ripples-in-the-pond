'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import TrackCatalog from '@/src/components/music-catalog/TrackCatalog';
import { initialTrackForView } from '@/src/lib/music-catalog/experience/route-selection';
import '@/app/tracks/tracks.css';
import '@/app/tracks/tracks-pond.css';

/** 首次进入后保留曲目、运动和颜色；仅上层可见性随路由改变。 */
export default function PreparedTracks() {
  const params = useSearchParams();
  const pathname = usePathname();
  const track = pathname === '/tracks' || pathname === '/tracks/pond' ? params.get('track') ?? undefined : undefined;
  return <TrackCatalog initialTrackId={initialTrackForView({ track })} />;
}
