import Link from 'next/link';

type Props = {
  authState: 'checking' | 'authenticated' | 'unauthenticated';
  authSource?: 'privy' | 'semi' | null;
  evmAddress?: string | null;
};

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** 私人档案页头：身份只作摘要，返回池塘始终是稳定出口。 */
export default function ArchiveHeader({
  authState,
  authSource,
  evmAddress,
}: Props) {
  const identity = authState === 'checking'
    ? '正在确认身份'
    : authState === 'unauthenticated'
      ? '尚未登录'
      : `${authSource === 'semi' ? 'SEMI' : 'PRIVY'}${evmAddress ? ` · ${shortAddress(evmAddress)}` : ''}`;

  return (
    <header className="me-archive__header">
      <nav className="me-archive__nav" aria-label="档案导航">
        <Link href="/" className="me-archive__back">
          <span aria-hidden="true">←</span>
          <span>返回池塘</span>
        </Link>
        <p className="me-archive__folio">RIPPLES IN THE POND</p>
        {authSource === 'semi' && authState === 'authenticated' ? (
          <a
            className="me-archive__identity me-archive__identity--link"
            href="https://semi.ntdao.xyz/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {identity} <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <p className="me-archive__identity">{identity}</p>
        )}
      </nav>

    </header>
  );
}
