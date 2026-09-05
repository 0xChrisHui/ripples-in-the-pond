/**
 * Token #1 的公开永久凭证快照。
 * 所有值均来自 2026-09-01 的链上与 Arweave 取证，不把核验时持有人冒充创作者。
 */
export const TOKEN_ONE = {
  name: 'Ripples #1',
  network: 'OP Mainnet',
  tokenId: '1',
  contract: '0xAc3F7471A4e1f5952b4c8f56521af46d6c20A4AA',
  holderAtBlock: '0x19da4b170dF5CcA47414b04f04a24f67E2E6bA54',
  verifiedBlock: '156320879',
  mintTx: '0x1d2de0a47e73114e87ecb7d81b5b49e61edb5f7b4a4c2871317811b53f182f4a',
  setUriTx: '0xaa72331c194da27e56c6243f27223b089a37ddbf2a94e5c5ca1774a8784550dc',
  metadataTx: 'YoRsYgKb2Wdc_a2ZRZVa9IU-TdFa8-OVCylVbKczIUo',
  eventsTx: '7wkFL72xytedtsM8JRU4duTJ9bX7zKDHhVLfUccTGZQ',
  baseTx: 'M-NM7NGjnakWHaNE8Su3LLO5qAGckpNeVX3weToIqIQ',
  soundsTx: 'NQsgcCSPJjeRzvXHnXNWbUsovDCjkO5xHJBX7Eu_kl8',
  decoderTx: 'NMCjKLoaRNWKgH0AyCDB6p8qjjv2iD2Fidzf7VAZmb0',
  mintedDate: '2026-08-23',
} as const;

export const TOKEN_ONE_URLS = {
  contract: `https://optimistic.etherscan.io/address/${TOKEN_ONE.contract}`,
  mintTx: `https://optimistic.etherscan.io/tx/${TOKEN_ONE.mintTx}`,
  setUriTx: `https://optimistic.etherscan.io/tx/${TOKEN_ONE.setUriTx}`,
  metadata: `https://arweave.net/${TOKEN_ONE.metadataTx}`,
  events: `https://arweave.net/${TOKEN_ONE.eventsTx}`,
  base: `https://arweave.net/${TOKEN_ONE.baseTx}`,
  sounds: `https://arweave.net/${TOKEN_ONE.soundsTx}`,
  decoder: `https://arweave.net/${TOKEN_ONE.decoderTx}?events=ar://${TOKEN_ONE.eventsTx}&base=ar%3A%2F%2F${TOKEN_ONE.baseTx}&sounds=ar://${TOKEN_ONE.soundsTx}`,
} as const;

export const TOKEN_ONE_URI = `ar://${TOKEN_ONE.metadataTx}`;
