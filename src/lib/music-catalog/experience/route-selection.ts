import { getMusicCatalog } from '../asset-registry';

export type TrackSearchParams = { track?: string | string[] };

/** 两种页面共用注册表编号；无效查询回到首曲，不维护第二份曲目表。 */
export function initialTrackForView({ track }: TrackSearchParams): string | undefined {
  if (typeof track !== 'string' || !/^\d{1,2}$/.test(track)) return undefined;
  return getMusicCatalog().tracks.find((item) => item.displayNumber === Number(track))?.trackId;
}
