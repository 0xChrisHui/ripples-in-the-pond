-- P10-B P1-1: 全库开启 Row Level Security
-- review: reviews/2026-07-05-backend-review.md P1-1
--
-- 背景：36 个历史 migration 无任何 RLS，安全押在"anon key 没被前端 import"一层纸上。
-- 本 migration 对全部现存表开 RLS 且【不加任何 policy】：
--   - service-role key（后端 API 全走它）绕过 RLS，不受影响；
--   - anon key 无 policy → 所有表读写归零。
--
-- 幂等：DO 块遍历表名，仅当表存在于 public schema 时才 enable（对缺
-- create migration 的 sounds 表、以及各环境差异都安全，可重复执行）。

do $$
declare
  t text;
  tbls text[] := array[
    'users',
    'tracks',
    'mint_queue',
    'mint_events',
    'pending_scores',
    'score_nft_queue',
    'score_covers',
    'system_kv',
    'chain_events',
    'airdrop_rounds',
    'airdrop_recipients',
    'jwt_blacklist',
    'auth_identities',
    'sounds'
  ];
begin
  foreach t in array tbls loop
    if exists (
      select 1 from pg_tables
      where schemaname = 'public' and tablename = t
    ) then
      execute format('alter table public.%I enable row level security;', t);
      raise notice 'RLS enabled: %', t;
    else
      raise notice 'skip (table not found): %', t;
    end if;
  end loop;
end $$;
