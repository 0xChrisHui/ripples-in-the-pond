import { saveScore } from '@/src/data/jam-source';
import { removeDraft, type Draft } from '@/src/lib/draft-store';
import { uploadedRecording, type ArchiveRecording } from './archive-data';

export type DraftSyncResult = {
  uploaded: ArchiveRecording[];
  failedIds: Set<string>;
};

const RETRY_DELAYS_MS = [250, 750] as const;

async function uploadDraft(token: string, draft: Draft, active: () => boolean) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (!active()) throw new Error('草稿同步已取消');
    try {
      return await saveScore(token, draft);
    } catch (error) {
      lastError = error;
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay == null) break;
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/** 服务端按 user + clientDraftId 幂等；这里串行上传以限制前台后台争用。 */
export async function syncLocalDrafts(
  token: string,
  drafts: readonly Draft[],
  active: () => boolean,
): Promise<DraftSyncResult> {
  const uploaded: ArchiveRecording[] = [];
  const failedIds = new Set<string>();
  for (const draft of drafts) {
    if (!active()) break;
    try {
      const result = await uploadDraft(token, draft, active);
      if (!active()) break;
      uploaded.push(uploadedRecording(draft, result));
      removeDraft(draft.trackId, draft.clientDraftId);
    } catch (error) {
      if (!active()) break;
      console.error('录音上传失败，仍保留在本机:', error);
      failedIds.add(draft.clientDraftId);
    }
  }
  return { uploaded, failedIds };
}
