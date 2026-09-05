import Link from 'next/link';

type ArchiveCount = {
  label: string;
  value: number | null;
};

type Props = {
  authState: 'checking' | 'authenticated' | 'unauthenticated';
  authSource?: 'privy' | 'semi' | null;
  evmAddress?: string | null;
  counts?: ArchiveCount[];
};

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** 私人档案页头：身份只作摘要，返回池塘始终是稳定出口。 */
export default function ArchiveHeader({
  authState,
  authSource,
  evmAddress,
  counts,
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
        <p className="me-archive__folio">PERSONAL ARCHIVE</p>
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

      <div className="me-archive__intro">
        <p className="me-archive__kicker">MY MUSIC / PRIVATE INDEX</p>
        <h1>我的音乐档案</h1>
        <p>唱片、录音与收藏的声音素材，按它们真实的制作状态留在这里。</p>
      </div>

      {counts && (
        <dl className="me-archive__summary" aria-label="档案数量摘要">
          {counts.map((item, index) => (
            <div key={item.label}>
              <dt><span>{String(index + 1).padStart(2, '0')}</span>{item.label}</dt>
              <dd aria-label={`${item.label}${item.value == null ? '正在读取' : `${item.value} 项`}`}>
                {item.value == null ? '—' : String(item.value).padStart(2, '0')}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
