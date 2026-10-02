import { getMusicCatalog } from '@/src/lib/music-catalog/asset-registry';
export function GET() {
  const catalog = getMusicCatalog();
  return Response.json(catalog, { headers: { ETag: `"${catalog.revision}"`, 'Cache-Control': 'public, max-age=300' } });
}
