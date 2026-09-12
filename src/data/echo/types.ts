import type { WalletRecipeMetadataV1, WalletRecipeQueueStatus } from '@/src/types/wallet-recipe';

export type EchoViewData = {
  tokenId: string;
  contractAddress: string;
  owner: string;
  originWallet: string;
  tokenUri: string;
  metadataTxId: string;
  metadata: WalletRecipeMetadataV1;
  network: string;
  explorerUrl: string;
  imageUrl: string;
  verifiedGateways: string[];
};

export type EchoArchiveItem = {
  key: string;
  tokenId: string | null;
  name: string;
  originWallet: string;
  currentOwner: string | null;
  tokenUri: string | null;
  status: WalletRecipeQueueStatus | 'owned';
  relation: 'current-owner' | 'origin-history';
  hasError: boolean;
};

export type MyEchoesResponse = {
  echoes: EchoArchiveItem[];
  onChainTotal: number;
  truncated: boolean;
  originStatusUnavailable: boolean;
};
