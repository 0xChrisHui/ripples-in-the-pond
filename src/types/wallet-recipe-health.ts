import type { WalletRecipeQueueStatus } from './wallet-recipe';

export type WalletRecipeStatusDistribution = Record<WalletRecipeQueueStatus, number>;

export interface WalletRecipeHealth {
  chainId: number;
  walletRecipeMode: 'off' | 'observe' | 'live';
  modeConfigured: boolean;
  configured: boolean;
  database: {
    tableReachable: boolean;
    rpcReachable: boolean;
  };
  permanentInputs: {
    clipManifestConfigured: boolean;
    decoderConfigured: boolean;
    imageConfigured: boolean;
  };
  contract: {
    addressConfigured: boolean;
    codeExists: boolean;
    minterRole: boolean | null;
  };
  activationBlock: string | null;
  expectedActivationMatches: boolean | null;
  lastDiscoveryCursor: string | null;
  sourceChainCursor: string | null;
  sourceCursorIdentity: {
    chainId: number;
    contract: string;
    key: string;
  };
  sourceLastSuccessAt: string | null;
  sourceSyncStale: boolean;
  cursors: {
    head: string | null;
    safeHead: string | null;
    discoveryToHeadBlocks: string | null;
    discoveryToSafeHeadBlocks: string | null;
    sourceToSafeHeadBlocks: string | null;
  };
  lastCronSuccessAt: string | null;
  cronStale: boolean;
  queue: {
    distribution: WalletRecipeStatusDistribution;
    active: number;
    failed: number;
    manualReview: number;
    success: number;
    excluded: number;
    oldestActiveAgeSeconds: number | null;
    uploadResultUnknown: number;
  };
  alerts: string[];
}
