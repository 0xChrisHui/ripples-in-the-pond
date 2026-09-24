import 'server-only';

import { getAddress, hashTypedData, keccak256, stringToHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  ETHEREUM_SCORE_NAME,
  ETHEREUM_SCORE_VERSION,
  MINT_AUTHORIZATION_TYPES,
  type MintAuthorization,
} from './ethereum-score-contract';
import type { SelfMintOrderRow } from './order';

const VOUCHER_TTL_SECONDS = 15 * 60;

function authorizerAccount() {
  const key = process.env.ETH_SCORE_AUTHORIZER_PRIVATE_KEY as Hex | undefined;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('ETH_SCORE_AUTHORIZER_PRIVATE_KEY 未配置或格式错误');
  }
  const account = privateKeyToAccount(key);
  const configured = process.env.ETH_SCORE_AUTHORIZER_ADDRESS;
  if (!configured || getAddress(configured) !== account.address) {
    throw new Error('ETH Score authorizer 私钥与公开地址不一致');
  }
  return account;
}

export function buildMintAuthorization(
  row: SelfMintOrderRow,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!row.token_uri) throw new Error('订单永久 tokenURI 尚未就绪');
  const account = authorizerAccount();
  const authorization: MintAuthorization = {
    orderId: row.order_id,
    tokenId: BigInt(row.token_id),
    recipient: getAddress(row.recipient_address),
    tokenURIHash: keccak256(stringToHex(row.token_uri)),
    deadline: BigInt(nowSeconds + VOUCHER_TTL_SECONDS),
  };
  const domain = {
    name: ETHEREUM_SCORE_NAME,
    version: ETHEREUM_SCORE_VERSION,
    chainId: row.chain_id,
    verifyingContract: getAddress(row.score_contract),
  } as const;
  const digest = hashTypedData({
    domain,
    types: MINT_AUTHORIZATION_TYPES,
    primaryType: 'MintAuthorization',
    message: authorization,
  });
  return { account, authorization, domain, digest };
}

export async function signMintAuthorization(row: SelfMintOrderRow) {
  const built = buildMintAuthorization(row);
  const signature = await built.account.signTypedData({
    domain: built.domain,
    types: MINT_AUTHORIZATION_TYPES,
    primaryType: 'MintAuthorization',
    message: built.authorization,
  });
  return { ...built, signature };
}
