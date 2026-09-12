import 'server-only';

import { createPublicClient, http } from 'viem';
import { CURRENT_CHAIN } from './chain-config';

/** 只读链客户端不依赖运营私钥，页面与公开 API 可安全复用。 */
export const publicClient = createPublicClient({
  chain: CURRENT_CHAIN,
  transport: http(process.env.ALCHEMY_RPC_URL),
});
