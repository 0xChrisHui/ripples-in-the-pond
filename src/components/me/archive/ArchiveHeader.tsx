import PondRouteLink from '@/src/components/pond-shell/PondRouteLink';
import type { ReactNode } from 'react';

type Props = {
  authState: 'checking' | 'authenticated' | 'unauthenticated';
  authSource?: 'privy' | 'semi' | null;
  evmAddress?: string | null;
  networkControl?: ReactNode;
};

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** 私人档案页头：身份只作摘要，返回池塘始终是稳定出口。 */
export default function ArchiveHeader({
  authState,
  authSource,
  evmAddress,
  networkControl,
}: Props) {
  const identity = authState === 'checking'
    ? '正在确认身份'
    : authState === 'unauthenticated'
      ? '尚未登录'
      : `${authSource === 'semi' ? 'SEMI' : 'PRIVY'}${evmAddress ? ` · ${shortAddress(evmAddress)}` : ''}`;

  return (
    <header className="me-archive__header">
      <nav className="me-archive__nav" aria-label="档案导航">
        <PondRouteLink href="/" className="me-archive__back" data-pond-focus-entry="archive">
          <span aria-hidden="true">←</span>
          <span>返回池塘</span>
        </PondRouteLink>
        <p className="me-archive__folio">RIPPLES IN THE POND</p>
        <div className="me-archive__account">
          {authSource === 'semi' && authState === 'authenticated' ? (
            <a className="me-archive__identity me-archive__identity--link"
              href="https://semi.ntdao.xyz/" target="_blank" rel="noopener noreferrer">
              {identity} <span aria-hidden="true">↗</span>
            </a>
          ) : <p className="me-archive__identity">{identity}</p>}
          {networkControl}
        </div>
      </nav>

    </header>
  );
}
