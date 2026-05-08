import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/src/lib/supabase';
import { verifyAdminToken } from '@/src/lib/auth/admin-auth';

/**
 * GET /api/cron/queue-status
 *
 * Phase 3 S5.c — 最小观测性（playbook 硬门槛）
 * cron 5 步状态机的配套观测 endpoint，给运营方看：
 *   - 按 status 分组的计数
 *   - 每个 status 下最老任务的 age（秒数）
 *   - 最近 24h 内 failed 任务的 last_error top 10
 *
 * 没有这个 endpoint，5 步状态机如果卡住就是盲飞——playbook 冻结决策。
 *
 * 鉴权（P1-10 修复，2026-05-08 strict CTO review）：Authorization: Bearer <ADMIN_TOKEN>
 *   原 ?token=xxx 已弃用 — query string 会进浏览器历史 / 代理日志 / 截图，泄露面大。
 *   运维脚本 / runbook 需同步改为 curl -H 'Authorization: Bearer ...'。
 */

type StatusCount = {
  status: string;
  count: number;
  oldest_age_seconds: number | null;
};

type RecentFailure = {
  id: string;
  last_error: string | null;
  retry_count: number;
  updated_at: string;
};

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req)) {
    return NextResponse.json({ error: '无效的 admin token' }, { status: 401 });
  }

  try {
    // 1. 拉全表，在内存里聚合
    //    （score_nft_queue 规模预期 < 10k，全表 select 没问题；
    //     未来量大可改成 SQL GROUP BY + RPC）
    const { data: rows, error } = await supabaseAdmin
      .from('score_nft_queue')
      .select('id, status, retry_count, last_error, updated_at, created_at')
      .order('created_at', { ascending: true });
    if (error) throw error;

    const now = Date.now();

    // 按 status 分组
    const statusMap = new Map<string, { count: number; oldestMs: number | null }>();
    for (const row of rows ?? []) {
      const existing = statusMap.get(row.status) ?? { count: 0, oldestMs: null };
      existing.count += 1;
      // 只统计非终态的 age
      const isTerminal = row.status === 'success' || row.status === 'failed';
      if (!isTerminal) {
        const ageMs = now - new Date(row.updated_at).getTime();
        if (existing.oldestMs == null || ageMs > existing.oldestMs) {
          existing.oldestMs = ageMs;
        }
      }
      statusMap.set(row.status, existing);
    }

    const by_status: StatusCount[] = [];
    for (const [status, v] of statusMap.entries()) {
      by_status.push({
        status,
        count: v.count,
        oldest_age_seconds: v.oldestMs != null ? Math.floor(v.oldestMs / 1000) : null,
      });
    }
    by_status.sort((a, b) => a.status.localeCompare(b.status));

    // 2. 最近 24h 的 failed 任务 last_error top 10
    const cutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const recent_failures: RecentFailure[] = (rows ?? [])
      .filter(
        (r) =>
          r.status === 'failed' &&
          r.updated_at >= cutoff &&
          r.last_error != null,
      )
      .slice(-10)
      .map((r) => ({
        id: r.id,
        last_error: r.last_error,
        retry_count: r.retry_count,
        updated_at: r.updated_at,
      }));

    // 3. 整体健康信号：是否有卡住超过 10 min 的非终态任务
    const STUCK_THRESHOLD_SECONDS = 10 * 60;
    const stuck = by_status.some(
      (s) => s.oldest_age_seconds != null && s.oldest_age_seconds > STUCK_THRESHOLD_SECONDS,
    );

    return NextResponse.json({
      result: 'ok',
      total_queue_rows: rows?.length ?? 0,
      by_status,
      recent_failures_24h: recent_failures,
      stuck_alert: stuck,
      stuck_threshold_seconds: STUCK_THRESHOLD_SECONDS,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[queue-status] error:', err);
    return NextResponse.json(
      { error: '查询失败', message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
