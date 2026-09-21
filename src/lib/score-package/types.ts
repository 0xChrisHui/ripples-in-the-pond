export const SCORE_PACKAGE_SCHEMA = 'ripples.score-package.v3' as const;
export const SCORE_PACKAGE_MAX_BYTES = 64 * 1024;

export const SCORE_PACKAGE_RESOURCE_ROLES = [
  'events', 'base', 'soundSet', 'decoder',
] as const;

export type ScorePackageResourceRole = (typeof SCORE_PACKAGE_RESOURCE_ROLES)[number];
export type ScorePackageResourceMime =
  | 'application/json'
  | 'audio/mpeg'
  | 'text/html'
  | 'text/html; charset=utf-8';

export type ScorePackageResource<Mime extends ScorePackageResourceMime> = Readonly<{
  arTxId: string;
  sha256: string;
  bytes: number;
  mime: Mime;
}>;

export type ScorePackageV3 = Readonly<{
  schema: typeof SCORE_PACKAGE_SCHEMA;
  queueId: string;
  /** 稳定内容身份，当前写入 pending_score_id，不依赖尚未产生的 tokenId。 */
  contentId: string;
  resources: Readonly<{
    events: ScorePackageResource<'application/json'>;
    base: ScorePackageResource<'audio/mpeg'>;
    soundSet: ScorePackageResource<'application/json'>;
    decoder: ScorePackageResource<'text/html' | 'text/html; charset=utf-8'>;
  }>;
}>;

export type ArweaveRef = `ar://${string}`;

export type ScorePlaybackReference =
  | Readonly<{ kind: 'package'; packageRef: ArweaveRef }>
  | Readonly<{
    kind: 'legacy';
    eventsRef: ArweaveRef;
    baseAudioRef: ArweaveRef;
    soundsMapRef: ArweaveRef;
  }>;

