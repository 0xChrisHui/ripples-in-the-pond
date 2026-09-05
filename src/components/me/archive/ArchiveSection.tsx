import type { ReactNode } from 'react';
import ArchiveEmpty from './ArchiveEmpty';

type Props = {
  index: number;
  title: string;
  count: number | null;
  loading: boolean;
  refreshing?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyDescription: string;
  children: ReactNode;
};

/** 档案分区独立呈现加载、刷新、错误和空态，不让单区故障遮住其他记录。 */
export default function ArchiveSection({
  index,
  title,
  count,
  loading,
  refreshing = false,
  error = null,
  onRetry,
  emptyDescription,
  children,
}: Props) {
  const isEmpty = !loading && !error && count === 0;

  return (
    <section className="archive-section" aria-labelledby={`archive-section-${index}`}>
      <header className="archive-section__header">
        <p>{String(index).padStart(2, '0')}</p>
        <h2 id={`archive-section-${index}`}>{title}</h2>
        <span aria-label={count == null ? `${title}正在读取` : `${title}${count}项`}>
          {count == null ? '—' : String(count).padStart(2, '0')}
        </span>
      </header>
      {(refreshing || error) && (
        <div className="archive-section__notice" role={error ? 'alert' : 'status'}>
          <span>{error ?? '正在用最新档案刷新当前记录…'}</span>
          {error && onRetry && <button type="button" onClick={onRetry}>重新读取</button>}
        </div>
      )}
      <div className="archive-section__body">{children}</div>
      {isEmpty && (
        <ArchiveEmpty
          compact
          eyebrow="NO ENTRIES"
          title={`${title}尚无记录`}
          description={emptyDescription}
        />
      )}
    </section>
  );
}
