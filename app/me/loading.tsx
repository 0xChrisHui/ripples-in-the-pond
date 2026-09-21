import ArchiveHeader from '@/src/components/me/archive/ArchiveHeader';
import ArchiveSection from '@/src/components/me/archive/ArchiveSection';
import '@/src/components/me/archive/archive.css';

export default function MeLoading() {
  return (
    <main className="me-archive" data-p11-theme="archive">
      <div className="me-archive__inner">
        <ArchiveHeader authState="checking" />
        <div className="me-archive__workspace" aria-busy="true" aria-label="正在读取音乐档案">
          <aside className="me-archive__rail">
            <div className="me-archive__index" aria-hidden="true">
              {['我的唱片', '待铸造', '收藏'].map((label, index) => (
                <button key={label} type="button" data-active={index === 0 || undefined} disabled>
                  <span><strong>{label}</strong><small>正在读取</small></span>
                </button>
              ))}
            </div>
          </aside>
          <ArchiveSection title="我的唱片" count={null} loading emptyDescription="">
            <div className="me-archive__skeleton" />
            <div className="me-archive__skeleton" />
          </ArchiveSection>
        </div>
      </div>
    </main>
  );
}
