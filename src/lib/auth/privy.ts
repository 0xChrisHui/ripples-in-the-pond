import type { PrivyClientConfig } from '@privy-io/react-auth';

/**
 * Privy 前端配置
 * 全局登记邮箱与 EVM 钱包；产品入口仍由自定义 LoginModal 定向触发。
 */
export const privyConfig: PrivyClientConfig = {
  loginMethods: ['email', 'wallet'],
  appearance: {
    theme: 'dark',
    accentColor: '#3b82f6',
    walletChainType: 'ethereum-only',
    walletList: ['metamask', 'wallet_connect', 'wallet_connect_qr', 'phantom', 'okx_wallet'],
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
  },
};
