import ArchiveHeader from '@/src/components/me/archive/ArchiveHeader';
import ArchiveSection from '@/src/components/me/archive/ArchiveSection';
import '@/src/components/me/archive/archive.css';

const sections = [
  { id: 'records', title: '我的唱片', className: 'me-archive__panel--records' },
  { id: 'pending', title: '待铸造', className: 'me-archive__panel--pending' },
  { id: 'favorites', title: '收藏', className: 'me-archive__panel--favorites' },
];

export default function MeLoading() {
  return (
    <main className="me-archive" data-p11-theme="archive">
      <div className="me-archive__inner">
        <ArchiveHeader authState="checking" />
        <div className="me-archive__dashboard" aria-busy="true" aria-label="正在读取音乐档案">
          {sections.map((section) => (
            <div key={section.id} className={`me-archive__panel ${section.className}`}>
              <ArchiveSection id={section.id} title={section.title} count={null}
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
