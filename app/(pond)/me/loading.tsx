'use client';

import { useTranslations } from 'next-intl';
import PageNavigation from '@/src/components/pond-shell/navigation/PageNavigation';
import ArchiveSection from '@/src/components/me/archive/ArchiveSection';
import '@/src/components/me/archive/archive.css';

const sections = [
  { id: 'records', className: 'me-archive__panel--records' },
  { id: 'pending', className: 'me-archive__panel--pending' },
  { id: 'favorites', className: 'me-archive__panel--favorites' },
] as const;

/** 客户端组件只为让标题与 aria-label 随语言切换；仍是静态骨架，不读数据 */
export default function MeLoading() {
  const t = useTranslations();
  return (
    <main className="me-archive" data-p11-theme="archive">
      <div className="me-archive__inner">
        <PageNavigation />
        <div className="me-archive__dashboard" aria-busy="true" aria-label={t('loading.meArchive')}>
          {sections.map((section) => (
            <div key={section.id} className={`me-archive__panel ${section.className}`}>
              <ArchiveSection id={section.id} title={t(`me.sections.${section.id}`)} count={null}
                loading emptyDescription="">
                <div className="me-archive__skeleton" />
                <div className="me-archive__skeleton" />
              </ArchiveSection>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
