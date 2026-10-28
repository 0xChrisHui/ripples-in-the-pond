import { loadEnglishContent } from '@/src/i18n/content/use-english-content';
import type { NoteSources } from './snippet-pool';

/**
 * 生产用来源。中文手记在第一次要出手记时才动态 import（不进首屏包）；
 * 英文复用现有英文内容加载（同一份 promise，不新增下载）。
 */
export const defaultNoteSources: NoteSources = {
  loadZhNotes: async () =>
    (await import('@/src/lib/music-catalog/data/artist-notes.json')).default as Record<string, string>,
  loadEnNotes: async () => (await loadEnglishContent()).notes,
};
