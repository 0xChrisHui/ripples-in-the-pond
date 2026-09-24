import type { ReactNode } from 'react';
import ArchiveEmpty from './ArchiveEmpty';

type Props = {
  id: string;
  title: string;
  count: number | null;
  loading: boolean;
  refreshing?: boolean;
  error?: string | null;
  warning?: string | null;
  onRetry?: () => void;
  emptyDescription: string;
  page?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;
  children: ReactNode;
};

/** 档案分区独立呈现加载、刷新、错误和空态，不让单区故障遮住其他记录。 */
export default function ArchiveSection({
  id,
  title,
  count,
  loading,
  refreshing = false,
  error = null,
  warning = null,
  onRetry,
  emptyDescription,
  page = 0,
  pageCount = 1,
  onPageChange,
  children,
}: Props) {
  const isEmpty = !loading && !error && count === 0;

  return (
    <section className="archive-section" aria-labelledby={`${id}-title`}
      data-archive-section={id} data-archive-page={page}>
      <header className="archive-section__header">
        <h2 id={`${id}-title`}>{title}</h2>
        <span aria-label={count == null ? `${title}正在读取` : `${title}${count}项`}>
          {count == null ? '—' : count}
        </span>
      </header>
      {(refreshing || error || warning) && (
        <div className="archive-section__notice" role={error ? 'alert' : 'status'}>
          <span>{error ?? warning ?? '正在用最新档案刷新当前记录…'}</span>
          {error && onRetry && <button type="button" onClick={onRetry}>重新读取</button>}
        </div>
      )}
      <div className="archive-section__body">{children}</div>
      {isEmpty && (
        <ArchiveEmpty
          compact
          title={`${title}尚无记录`}
          description={emptyDescription}
        />
      )}
      {pageCount > 1 && onPageChange && (
        <nav className="archive-section__pagination" aria-label={`${title}分页`}>
          <button type="button" disabled={page === 0} onClick={() => onPageChange(page - 1)}>← 上一页</button>
          <span>{page + 1} / {pageCount}</span>
          <button type="button" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)}>下一页 →</button>
        </nav>
      )}
    </section>
  );
}
