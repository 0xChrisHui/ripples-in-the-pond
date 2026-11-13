'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export type ProvenanceEntry = {
  id: string;
  label: string;
  value?: string | null;
  displayValue?: string;
  source: string;
  href?: string;
  copyable?: boolean;
  missingLabel?: string;
  warning?: boolean;
};

type Props = {
  title?: string;
  entries: ProvenanceEntry[];
  compact?: boolean;
  groups?: { title: string; ids: string[] }[];
};

function shortValue(value: string): string {
  if (value.length <= 24) return value;
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export async function copyFullValue(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (error) {
    console.warn('系统剪贴板不可用，尝试兼容复制：', error);
  }

  const field = document.createElement('textarea');
  field.value = value;
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand('copy');
  } catch (error) {
    console.error('永久凭证复制失败：', error);
    return false;
  } finally {
    field.remove();
  }
}

/** 账面短显以便阅读，但复制动作始终写入未截断的原始值。 */
export default function ProvenanceLedger({ title: titleProp, entries, compact = false, groups }: Props) {
  const t = useTranslations('ledger');
  const title = titleProp ?? t('title');
  const [copyResult, setCopyResult] = useState<{ id: string; ok: boolean } | null>(null);

  async function copyEntry(entry: ProvenanceEntry) {
    if (!entry.value) return;
    const ok = await copyFullValue(entry.value);
    setCopyResult({ id: entry.id, ok });
  }

  return (
    <section className="provenance-ledger" aria-label={title} data-compact={compact || undefined}>
      {!compact && <header className="provenance-ledger__header">
        <p>{title}</p>
        <span>{t('count', { count: entries.length })}</span>
      </header>}

      {(groups ?? [{ title: '', ids: entries.map((e) => e.id) }]).map((group) => <div key={group.title}>
      {group.title && <h3 className="provenance-ledger__group-title">{group.title}</h3>}
      <dl className="provenance-ledger__list">
        {entries.filter((e) => group.ids.includes(e.id)).map((entry) => {
          const hasValue = typeof entry.value === 'string' && entry.value.trim().length > 0;
          const feedback = copyResult?.id === entry.id ? copyResult : null;

          return (
            <div className="provenance-ledger__row" data-missing={!hasValue} data-warning={entry.warning || undefined} key={entry.id}>
              <dt>{entry.label}</dt>
              <dd>
                <div className="provenance-ledger__value">
                  {hasValue ? (
                    <code title={entry.value ?? undefined} aria-label={t('valueLabel', { label: entry.label, value: entry.value ?? '' })}>
                      {feedback && !feedback.ok
                        ? entry.value
                        : entry.displayValue ?? shortValue(entry.value as string)}
                    </code>
                  ) : (
                    <span className="provenance-ledger__missing">
                      {entry.missingLabel ?? t('missing')}
                    </span>
                  )}
                  <small>{compact ? entry.source : t('source', { source: entry.source })}</small>
                </div>
                <div className="provenance-ledger__actions">
                  {hasValue && entry.copyable !== false && (
                    <button type="button" onClick={() => copyEntry(entry)} aria-label={t('copyFull')}>
                      {compact ? feedback?.ok ? '✓' : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></svg> : feedback ? (feedback.ok ? t('copied') : t('copyFailed')) : t('copyFull')}
                    </button>
                  )}
                  {hasValue && entry.href && (
                    <a href={entry.href} target="_blank" rel="noopener noreferrer" aria-label={t('external')}>
                      {!compact && t('external')} <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </div>
              </dd>
            </div>
          );
        })}
      </dl>
      </div>)}
      <p className="p11-visually-hidden" aria-live="polite">
        {copyResult && (copyResult.ok ? t('copiedFull') : t('copyFailedManual'))}
      </p>
    </section>
  );
}
