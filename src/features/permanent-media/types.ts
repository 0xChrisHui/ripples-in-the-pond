export type PermanentMediaKind = 'json' | 'audio' | 'binary';

export type PermanentMediaSource =
  | 'cache'
  | 'mirror'
  | 'ardrive'
  | 'arweave-tokyo'
  | 'arweave';

export type PermanentMediaFailureKind =
  | 'aborted'
  | 'timeout'
  | 'dns'
  | 'network'
  | 'http'
  | 'content-type'
  | 'range'
  | 'too-large'
  | 'hash-mismatch'
  | 'unavailable';

export type PermanentMediaValidation =
  | Readonly<{ level: 'canonical'; sha256: string }>
  | Readonly<{ level: 'compatibility'; sha256?: string }>;

export type PermanentMediaCandidate = Readonly<{
  source: PermanentMediaSource;
  healthKey: string;
  label: string;
  url: string;
}>;

export type PermanentMediaFailure = Readonly<{
  source: PermanentMediaSource;
  kind: Exclude<PermanentMediaFailureKind, 'aborted' | 'unavailable'>;
  status?: number;
}>;

export type PermanentMediaResult = Readonly<{
  bytes: ArrayBuffer;
  contentType: string | null;
  source: PermanentMediaSource;
  verification: 'sha256' | 'compatibility';
}>;

export type PermanentMediaOptions = Readonly<{
  kind: PermanentMediaKind;
  validation: PermanentMediaValidation;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  mirrorBaseUrl?: string;
  maxBytes?: number;
  timeoutMs?: number;
  rounds?: number;
  retryDelayMs?: number;
  health?: PermanentMediaHealthContract;
  mirrorProbe?: PermanentMediaMirrorProbeContract;
  mirrorProbeTimeoutMs?: number;
  mirrorFallbackDelayMs?: number;
  mirrorTimeoutMs?: number;
}>;

export type PermanentMediaMirrorProbeRequest = Readonly<{
  fetcher: typeof fetch;
  signal?: AbortSignal;
  mirrorBaseUrl?: string;
  timeoutMs?: number;
}>;

export interface PermanentMediaMirrorProbeContract {
  select(ref: string, request: PermanentMediaMirrorProbeRequest): Promise<string>;
  recordServiceFailure?(mirrorBaseUrl: string): void;
  recordServiceSuccess?(mirrorBaseUrl: string): void;
}

export interface PermanentMediaHealthContract {
  canAttempt(key: string): boolean;
  recordFailure(key: string, kind: PermanentMediaFailure['kind']): void;
  recordSuccess(key: string): void;
}

export class PermanentMediaError extends Error {
  constructor(
    public readonly kind: PermanentMediaFailureKind,
    message: string,
    public readonly attempts: readonly PermanentMediaFailure[] = [],
  ) {
    super(message);
    this.name = 'PermanentMediaError';
  }
}
