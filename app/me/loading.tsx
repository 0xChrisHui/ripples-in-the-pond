import ArchiveHeader from '@/src/components/me/archive/ArchiveHeader';
import ArchiveSection from '@/src/components/me/archive/ArchiveSection';
import '@/src/components/me/archive/archive.css';

const sections = ['我的唱片', '我的录音', '我的素材'];

export default function MeLoading() {
  return (
    <main className="me-archive" data-p11-theme="archive">
      <div className="me-archive__inner">
        <ArchiveHeader authState="checking" counts={sections.map((label) => ({ label, value: null }))} />
        <div className="me-archive__sections" aria-busy="true" aria-label="正在读取音乐档案">
          {sections.map((title, index) => (
            <ArchiveSection key={title} index={index + 1} title={title} count={null}
              loading emptyDescription="">
              <div className="me-archive__skeleton" />
              <div className="me-archive__skeleton" />
            </ArchiveSection>
          ))}
        </div>
      </div>
    </main>
  );
}
