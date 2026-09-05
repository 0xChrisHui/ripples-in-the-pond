'use client';

import { useState } from 'react';

export type ProvenanceEntry = {
  id: string;
  label: string;
  value?: string | null;
  displayValue?: string;
  source: string;
  href?: string;
  copyable?: boolean;
  missingLabel?: string;
};

type Props = {
  title?: string;
  entries: ProvenanceEntry[];
};

function shortValue(value: string): string {
  if (value.length <= 24) return value;
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

async function copyFullValue(value: string): Promise<boolean> {
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
export default function ProvenanceLedger({ title = '永久凭证', entries }: Props) {
  const [copyResult, setCopyResult] = useState<{ id: string; ok: boolean } | null>(null);

  async function copyEntry(entry: ProvenanceEntry) {
    if (!entry.value) return;
    const ok = await copyFullValue(entry.value);
    setCopyResult({ id: entry.id, ok });
  }

  return (
    <section className="provenance-ledger" aria-label={title}>
      <header className="provenance-ledger__header">
        <p>{title}</p>
        <span>{entries.length} 项记录</span>
      </header>

      <dl className="provenance-ledger__list">
        {entries.map((entry) => {
          const hasValue = typeof entry.value === 'string' && entry.value.trim().length > 0;
          const feedback = copyResult?.id === entry.id ? copyResult : null;

          return (
            <div className="provenance-ledger__row" data-missing={!hasValue} key={entry.id}>
              <dt>{entry.label}</dt>
              <dd>
                <div className="provenance-ledger__value">
                  {hasValue ? (
                    <code title={entry.value ?? undefined} aria-label={`${entry.label}：${entry.value}`}>
                      {feedback && !feedback.ok
                        ? entry.value
                        : entry.displayValue ?? shortValue(entry.value as string)}
                    </code>
                  ) : (
                    <span className="provenance-ledger__missing">
                      {entry.missingLabel ?? '未记录 · 原始来源未提供'}
                    </span>
                  )}
                  <small>来源：{entry.source}</small>
                </div>
                <div className="provenance-ledger__actions">
                  {hasValue && entry.copyable !== false && (
                    <button type="button" onClick={() => copyEntry(entry)}>
                      {feedback ? (feedback.ok ? '已复制' : '复制失败') : '复制完整值'}
                    </button>
                  )}
                  {hasValue && entry.href && (
                    <a href={entry.href} target="_blank" rel="noopener noreferrer">
                      查看外部记录 <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </div>
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="p11-visually-hidden" aria-live="polite">
        {copyResult && (copyResult.ok ? '完整值已复制' : '复制失败，请手动选择完整值')}
      </p>
    </section>
  );
}
