import type { Track } from '@/src/types/tracks';

/**
 * 假数据 — 5 首曲目，Track C 集成后这个文件不再被 import
 * 颜色用 Tailwind 色板名，Island 组件会映射成实际 class
 */
export const MOCK_TRACKS: Track[] = [
  {
    id: 'track-001',
    title: '潮汐',
    week: 1,
    audio_url: '/tracks/001.mp3',
    cover: 'blue',
    island: '蓝岛',
    created_at: '2026-01-06',
  },
  {
    id: 'track-002',
    title: '晨雾',
    week: 2,
    audio_url: '/tracks/001.mp3',
    cover: 'emerald',
    island: '绿岛',
    created_at: '2026-01-13',
  },
  {
    id: 'track-003',
    title: '星尘',
    week: 3,
    audio_url: '/tracks/001.mp3',
    cover: 'violet',
    island: '紫岛',
    created_at: '2026-01-20',
  },
  {
    id: 'track-004',
    title: '深渊',
    week: 4,
    audio_url: '/tracks/001.mp3',
    cover: 'amber',
    island: '金岛',
    created_at: '2026-01-27',
  },
  {
    id: 'track-005',
    title: '回声',
    week: 5,
    audio_url: '/tracks/001.mp3',
    cover: 'rose',
    island: '红岛',
    created_at: '2026-02-03',
  },
];
