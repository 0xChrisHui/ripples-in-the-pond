'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { privyConfig } from '@/src/lib/auth/privy';
import { PlayerProvider } from '@/src/components/player/PlayerProvider';
import BottomPlayer from '@/src/components/player/BottomPlayer';
import LoginModal from '@/src/components/auth/LoginModal';

/**
 * 全局 Provider 包装层
 * layout.tsx 是 Server Component，不能直接用 PrivyProvider，
 * 所以抽成这个 client component 中转
 *
 * Phase 7 Track B B2：挂全站登录 modal（两 tab：Privy 邮箱 / Semi 社区钱包）
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={privyConfig}
    >
      <PlayerProvider>
        {children}
        <BottomPlayer />
        <LoginModal />
      </PlayerProvider>
    </PrivyProvider>
  );
}
