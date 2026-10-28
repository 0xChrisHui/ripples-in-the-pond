import { useTranslations } from 'next-intl';
import { renderMaterialNotice, type MaterialNotice, type RenderedMaterialNotice } from '../../../features/material-catalog/mint/friendly-error';
import { useLocaleSwitch } from '../../../i18n/LocaleProvider';

/** 已按当前语言取好词的提示（渲染时现算的文案用这个；要存进状态的提示用 MaterialNoticeView 存键） */
export function MaterialNoticeBox({ notice }: { notice: RenderedMaterialNotice }) {
  const t = useTranslations('material.notice');
  return <div className="material-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>
    <strong>{notice.title}</strong>
    {notice.hint && <p>{notice.hint}</p>}
    {notice.detail && <details><summary>{t('technical')}</summary><pre>{notice.detail}</pre></details>}
  </div>;
}

/** 存键的提示：切换语言后重新取词 */
export default function MaterialNoticeView({ notice }: { notice: MaterialNotice }) {
  const t = useTranslations('material'), { locale } = useLocaleSwitch();
  return <MaterialNoticeBox notice={renderMaterialNotice(notice, locale, (key) => t(key as never))} />;
}
