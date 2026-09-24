export type AuthSource = 'privy' | 'semi' | null;
export type LoginEntry = 'email' | 'semi' | 'external_wallet' | null;
export type WalletKind = 'external' | 'embedded' | 'none';

export interface WalletCapability {
  authSource: AuthSource;
  loginEntry: LoginEntry;
  walletKind: WalletKind;
  activeWalletAddress: string | null;
  walletClientType: string | null;
  connectorType: string | null;
  canChooseMintChain: boolean;
  canSelfPayEthGas: boolean;
}

export interface ExternalWalletCheck {
  allowed: boolean;
  selfMintAllowed: boolean;
  walletClientType: string | null;
  connectorType: string | null;
}
