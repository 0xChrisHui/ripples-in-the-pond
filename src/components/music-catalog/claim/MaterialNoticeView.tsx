import { useTranslations } from 'next-intl';
import type { MaterialNotice } from '../../../features/material-catalog/mint/friendly-error';

export default function MaterialNoticeView({ notice }: { notice: MaterialNotice }) {
  const t = useTranslations('material.notice');
  return <div className="material-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>
    <strong>{notice.title}</strong>
    {notice.hint && <p>{notice.hint}</p>}
    {notice.detail && <details><summary>{t('technical')}</summary><pre>{notice.detail}</pre></details>}
  </div>;
}
