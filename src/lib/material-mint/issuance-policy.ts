// 用户2026-10-03明确批准；总量无限不改变每个钱包每首只能领一次。
export const ETH_MATERIAL_ISSUANCE_POLICY = Object.freeze({
  id: 'eth-original-wallet-once-v1',
  perWalletPerToken: 1,
  transferable: true,
  reclaimAfterTransfer: false,
  totalSupplyCap: null,
});
export const ETH_MATERIAL_POLICY_APPROVAL = 'user-2026-10-03-eth-originals';
