'use client';

import { useLocaleSwitch } from '@/src/i18n/LocaleProvider';
import { useTranslations } from 'next-intl';

export type EditionStatus = 'finalized' | 'processing' | 'degraded' | 'failed';

type Props = {
  status: EditionStatus;
  detail?: string;
};

const codes: Record<EditionStatus, string> = { finalized: 'FINALIZED', processing: 'PROCESSING', degraded: 'DEGRADED', failed: 'FAILED' };

/** 每个版本状态同时提供形状、中文与机器式代码，不只依赖颜色。英文模式只留机器式代码（P19 D3：中英并列只显示英文部分）。 */
export default function EditionStamp({ status, detail }: Props) {
  const t = useTranslations('edition');
  const { locale } = useLocaleSwitch();

  return (
    <span className="edition-stamp" data-status={status} role="status">
      <span className="edition-stamp__mark" aria-hidden="true" />
      {locale === 'zh' && <span className="edition-stamp__label">{t(status)}</span>}
      <span className="edition-stamp__code">{codes[status]}</span>
      {detail && <span className="edition-stamp__detail">{detail}</span>}
    </span>
  );
}
