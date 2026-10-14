'use client';

import { useLocaleSwitch } from '@/src/i18n/LocaleProvider';

export type EditionStatus = 'finalized' | 'processing' | 'degraded' | 'failed';

type Props = {
  status: EditionStatus;
  detail?: string;
};

const labels: Record<EditionStatus, { label: string; code: string }> = {
  finalized: { label: '已定稿', code: 'FINALIZED' },
  processing: { label: '处理中', code: 'PROCESSING' },
  degraded: { label: '降级可读', code: 'DEGRADED' },
  failed: { label: '处理失败', code: 'FAILED' },
};

/** 每个版本状态同时提供形状、中文与机器式代码，不只依赖颜色。英文模式只留机器式代码（P19 D3：中英并列只显示英文部分）。 */
export default function EditionStamp({ status, detail }: Props) {
  const copy = labels[status];
  const { locale } = useLocaleSwitch();

  return (
    <span className="edition-stamp" data-status={status} role="status">
      <span className="edition-stamp__mark" aria-hidden="true" />
      {locale === 'zh' && <span className="edition-stamp__label">{copy.label}</span>}
      <span className="edition-stamp__code">{copy.code}</span>
      {detail && <span className="edition-stamp__detail">{detail}</span>}
    </span>
  );
}
