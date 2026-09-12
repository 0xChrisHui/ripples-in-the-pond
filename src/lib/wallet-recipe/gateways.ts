export const WALLET_RECIPE_GATEWAYS = [
  'https://ardrive.net',
  'https://arweave.tokyo',
  'https://arweave.net',
] as const;

export const WALLET_RECIPE_GATEWAY_QUORUM = 2;

export function hasWalletRecipeGatewayQuorum(
  evidence: readonly { gateway: string; ok: boolean }[],
): boolean {
  return new Set(evidence.filter((item) => item.ok).map((item) => item.gateway)).size
    >= WALLET_RECIPE_GATEWAY_QUORUM;
}
