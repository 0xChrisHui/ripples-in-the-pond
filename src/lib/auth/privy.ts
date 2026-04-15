import type { PrivyClientConfig } from '@privy-io/react-auth';

/**
 * Privy 前端配置
 * loginMethods 只开邮箱，embedded wallet 自动创建
 */
export const privyConfig: PrivyClientConfig = {
  loginMethods: ['email'],
  appearance: {
    theme: 'dark',
    accentColor: '#3b82f6',
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
  },
};
