import type { SoundKey } from '../../../src/lib/sound-set';

export const COMPAT_SCHEMA = 'ripples.score-compatibility.v1' as const;

export type PermanentSoundIdentity = Readonly<{
  arTxId: string;
  sha256: string;
  bytes: number;
  mime: 'audio/mpeg';
}>;

export type CompatibilityPayload = Readonly<{
  schema: typeof COMPAT_SCHEMA;
  chainId: number;
  scoreContract: `0x${string}`;
  tokenId: number;
  originalTokenURI: `ar://${string}`;
  original: Readonly<{
    events: `ar://${string}`;
    base: `ar://${string}`;
    sounds: `ar://${string}`;
  }>;
  effectiveSounds: Readonly<Partial<Record<SoundKey, PermanentSoundIdentity>>>;
  publishedAt: string;
  resolution: Readonly<{
    soundSet: 'legacy-26' | 'current-33-v1';
    usedKeys: readonly SoundKey[];
    changes: readonly Readonly<{
      key: SoundKey;
      mode: 'retained' | 'addition' | 'override';
      fromArTxId: string | null;
      toArTxId: string;
    }>[];
    reason: string;
  }>;
}>;

export type CompatibilitySignature = Readonly<{
  scheme: 'eip712';
  signer: `0x${string}`;
  value: `0x${string}`;
  adminRole: `0x${string}`;
  roleBlockNumber: string;
  domain: Readonly<{
    name: 'RipplesCompatibility';
    version: '1';
    chainId: number;
    verifyingContract: `0x${string}`;
  }>;
  message: Readonly<{
    tokenId: string;
    originalTokenURI: string;
    originalEvents: string;
    originalBase: string;
    originalSounds: string;
    effectiveSoundsDigest: `0x${string}`;
    canonicalDigest: `0x${string}`;
    publishedAt: string;
    roleBlockNumber: string;
  }>;
}>;

export type CompatibilityManifest = CompatibilityPayload & Readonly<{
  canonicalDigest: string;
  signature: CompatibilitySignature;
}>;

export type CompatibilitySource = Readonly<{
  tokenId: number;
  tokenUri: `ar://${string}`;
  refs: Readonly<{ events: string; base: string; sounds: string }>;
  usedKeys: readonly SoundKey[];
  effectiveSounds: Readonly<Partial<Record<SoundKey, PermanentSoundIdentity>>>;
  soundSet: 'legacy-26' | 'current-33-v1';
  changes: CompatibilityPayload['resolution']['changes'];
}>;

export type CompatUploadState = 'uploading' | 'uploaded' | 'verified' | 'upload_result_unknown';
export type CompatGatewayEvidence = Readonly<{
  gateway: string; status: number | null; bytes: number | null; sha256: string | null;
  contentType: string | null; signatureValid: boolean; ok: boolean; error: string | null;
}>;
export type CompatUploadEntry = {
  tokenId: number; bytes: number; contentSha256: string; state: CompatUploadState;
  arweaveTxId: string | null; uploaderAddress: string | null; costWinc: string | null;
  attemptedAt: string; uploadedAt: string | null; verifiedAt: string | null;
  lastError: string | null; gatewayEvidence: CompatGatewayEvidence[];
};
export type CompatUploadLedger = Readonly<{
  schema: 'ripples.compat-upload-ledger.v1';
  assets: Record<string, CompatUploadEntry>;
}>;
