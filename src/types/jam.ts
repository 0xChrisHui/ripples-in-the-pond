/**
 * 合奏相关共享类型 — Track A / Track B / Track C 共用
 * 改这个文件前所有线必须对齐
 *
 * 冻结的 API 端点命名：
 *   GET  /api/sounds                → SoundsListResponse
 *   POST /api/score/save            → SaveScoreResponse
 *   GET  /api/scores/[id]/preview   → ScorePreviewResponse
 *   GET  /api/me/scores             → MyScoresResponse
 */

import type { Track } from './tracks';

/** 一个键盘音效定义 */
export interface Sound {
  id: string;
  /** tokenId 109-134 */
  token_id: number;
  /** 音效名称（如 "Kick", "Snare", "Bell"） */
  name: string;
  /** 本地路径或 Arweave URL */
  audio_url: string;
  /** 时长（毫秒） */
  duration_ms: number;
  /** 分类 */
  category: 'percussion' | 'melody' | 'effect';
  /** 对应键盘键（a-z、3-8 或 space） */
  key: string;
}

/** 单次按键事件 */
export interface KeyEvent {
  /** 按的键（a-z、3-8 或 space） */
  key: string;
  /** 距离录制开始的时间（毫秒） */
  time: number;
  /** 按键持续时间（毫秒） */
  duration: number;
}

/** 已铸 Score 由 metadata.animation_url 永久钉住的四项播放输入。 */
export type ScorePlaybackManifest = {
  permanentDecoderUrl: string; eventsRef: string; baseAudioRef: string; soundsMapRef: string;
};

/** pending_scores 表的一行 — 合奏草稿（状态机表，禁止 DELETE） */
export interface PendingScore {
  id: string;
  user_id: string;
  track_id: string;
  /** 按键事件序列 */
  events_data: KeyEvent[];
  /** draft = 有效草稿，expired = 已过期（不删除，标记状态） */
  status: 'draft' | 'expired';
  created_at: string;
  updated_at: string;
  /** 24h 后过期 */
  expires_at: string;
}

/** API 响应：GET /api/sounds */
export interface SoundsListResponse {
  sounds: Sound[];
}

/** API 请求体：POST /api/score/save */
export interface SaveScoreRequest {
  /** 客户端草稿稳定身份；服务端按 user + 此字段保证重复上传幂等。 */
  clientDraftId: string;
  trackId: string;
  eventsData: KeyEvent[];
  /** 创作时间（ISO 字符串），服务端按此计算 24h TTL，超过 24h 拒绝 */
  createdAt: string;
}

/** API 响应：POST /api/score/save */
export interface SaveScoreResponse {
  result: 'ok';
  scoreId: string;
  expiresAt: string;
}

/** API 响应：GET /api/scores/[id]/preview */
export interface ScorePreviewResponse {
  score: {
    trackId: string;
    eventsData: KeyEvent[];
    expiresAt: string;
  };
}

/** API 响应：GET /api/me/scores
 *
 *  B8 简化（2026-05-07）：草稿入队后立刻从此端点消失（route.ts 用 NOT IN queue 过滤），
 *  转去"我的唱片"显示。所以本响应里的草稿都是"未铸造的活草稿"。
 *  Phase 2 加 track + events 让"我的创作"里的草稿可以前端 inline 播放
 *  （PlayerProvider 播底曲 + useEventsPlayback 按 events.time 触发音效）。
 */
export interface MyScoresResponse {
  scores: {
    id: string;
    /** 录音绑定的底曲（档案行试听时交给全局 Player） */
    track: Track;
    /** 按键事件序列；light 模式不返回，档案行点击试听时再拉 */
    events?: KeyEvent[];
    /** 该用户对同一曲目的第几次创作 */
    seq: number;
    /** 音符数量（= events.length，前端方便用） */
    eventCount: number;
    createdAt: string;
    expiresAt: string;
  }[];
}

export * from './score-mint';
