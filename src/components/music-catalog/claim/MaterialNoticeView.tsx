import type { MaterialNotice } from '../../../features/material-catalog/mint/friendly-error';

export default function MaterialNoticeView({ notice }: { notice: MaterialNotice }) {
  return <div className="material-notice" data-tone={notice.tone} role={notice.tone === 'error' ? 'alert' : 'status'}>
    <strong>{notice.title}</strong>
    {notice.hint && <p>{notice.hint}</p>}
    {notice.detail && <details><summary>技术详情</summary><pre>{notice.detail}</pre></details>}
  </div>;
}
