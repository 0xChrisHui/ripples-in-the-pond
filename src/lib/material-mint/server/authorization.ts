import 'server-only';
import { getAddress, keccak256, stringToHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { buildMaterialTypedData } from '../contract';
import type { MaterialOrder } from '../types';
import { requireMaterialIssuancePolicy, MaterialError } from './policy';
import { requireMaterialMode } from './access';
import { requireMaterialClaimAvailable } from './eligibility';
import { getChainPublicClient } from '../../chain/multichain/public-client';
import { getOriginalDeployment } from '../../music-catalog/asset-registry';
export async function signMaterialOrder(row: MaterialOrder) {
  requireMaterialMode(row.user_id); requireMaterialIssuancePolicy();
  if (!['prepared', 'authorized', 'reverted'].includes(row.status)) {
    throw new MaterialError('已有发送等待核对', 'UNSAFE_AUTHORIZATION');
  }
  const deployment = getOriginalDeployment(row.track_id, row.chain_id);
  if (!deployment || deployment.status !== 'ready' || !deployment.contractAddress
    || getAddress(deployment.contractAddress) !== getAddress(row.contract_address)
    || deployment.tokenId !== row.token_id || deployment.metadataUri !== row.metadata_uri) {
    throw new MaterialError('冻结订单对应发行尚未完成真实部署核验', 'DEPLOYMENT_NOT_READY', 503);
  }
  await requireMaterialClaimAvailable(getChainPublicClient(row.chain_id), row);
  const privateKey = process.env.ETH_MATERIAL_AUTHORIZER_PRIVATE_KEY as Hex | undefined;
  const configured = process.env.ETH_MATERIAL_AUTHORIZER_ADDRESS;
  if (!privateKey || !/^0x[0-9a-f]{64}$/i.test(privateKey) || !configured) throw new Error('原曲签名配置未就绪');
  const account = privateKeyToAccount(privateKey);
  if (account.address !== getAddress(configured)) throw new Error('原曲签名者与配置不一致');
  const authorization = { orderId: row.order_id, tokenId: BigInt(row.token_id), amount: 1n,
    recipient: getAddress(row.recipient_address), tokenURIHash: keccak256(stringToHex(row.metadata_uri)),
    deadline: BigInt(Math.floor(Date.now() / 1000) + 900) };
  if (authorization.tokenURIHash !== row.uri_hash) throw new Error('冻结订单 URI hash 不符');
  const typedData = buildMaterialTypedData(row.chain_id, row.contract_address, authorization);
  const signature = await account.signTypedData(typedData);
  return { signature, authorizer: account.address, authorization, typedData };
}
