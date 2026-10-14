import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import ArchiveEmpty from './ArchiveEmpty';

type Props = {
  id: string;
  title: string;
  count: number | null;
  loading: boolean;
  refreshing?: boolean;
  error?: string | null;
  warning?: string | null;
  /** 缓存中的收藏记录正在核对持有人（原先靠比对 warning 文字判断，改成显式状态以便多语言） */
  checkingOwner?: boolean;
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
  checkingOwner = false,
  onRetry,
  emptyDescription,
  page = 0,
  pageCount = 1,
  onPageChange,
  children,
}: Props) {
  const t = useTranslations('me.archive');
  const tc = useTranslations('common');
  const isEmpty = !loading && !error && count === 0;
  const detail = checkingOwner
    ? (error ? t('checkingDetailWithError', { error }) : t('checkingDetail')) : error ?? warning;
  const status = error ? t('statusError') : checkingOwner ? t('statusChecking') : warning ? t('statusWarning')
    : refreshing ? t('statusRefreshing') : '';

  return (
    <section className="archive-section" aria-labelledby={`${id}-title`}
      data-archive-section={id} data-archive-page={page}>
      <header className="archive-section__header">
        <h2 id={`${id}-title`}>{title}</h2>
        <span aria-label={count == null ? t('countLoading', { title }) : t('count', { title, count })}>
          {count == null ? '—' : count}
        </span>
        <div className="archive-section__status">
          <span className="archive-section__announcement" aria-live="polite" aria-atomic="true">{status}</span>
          {detail && (
            <details className="archive-section__details" key={detail}>
              <summary aria-label={t('detailsLabel', { status })}>{t('details', { status })}</summary>
              <div className="archive-section__notice">
                <p>{detail}</p>
                {error && onRetry && <button type="button" onClick={onRetry}>{tc('retry')}</button>}
              </div>
            </details>
          )}
          {!detail && <span aria-hidden="true">{status}</span>}
        </div>
      </header>
      <div className="archive-section__body">{children}</div>
      {isEmpty && (
        <ArchiveEmpty
          compact
          title={t('emptyTitle', { title })}
          description={emptyDescription}
        />
      )}
      {pageCount > 1 && onPageChange && (
        <nav className="archive-section__pagination" aria-label={t('pagination', { title })}>
          <button type="button" disabled={page === 0} onClick={() => onPageChange(page - 1)}>{t('prev')}</button>
          <span>{page + 1} / {pageCount}</span>
          <button type="button" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)}>{t('next')}</button>
        </nav>
      )}
    </section>
  );
}
