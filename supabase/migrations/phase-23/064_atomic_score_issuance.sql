-- 先迁移和上线兼容代码，再通过生产切换将新订单默认值改为 atomic。
begin;
alter table public.score_nft_queue
  add column issuance_mode text not null default 'legacy' check (issuance_mode in ('legacy', 'atomic')),
  add column atomic_issuer text,
  add column atomic_recipient text,
  add column expected_token_id bigint check (expected_token_id > 0),
  add column atomic_ready_at timestamptz,
  add constraint atomic_score_reservation_complete check (
    (expected_token_id is null and atomic_issuer is null and atomic_recipient is null)
    or (issuance_mode = 'atomic' and expected_token_id is not null
      and atomic_issuer ~ '^0x[0-9a-fA-F]{40}$' and atomic_recipient ~ '^0x[0-9a-fA-F]{40}$'
      and atomic_issuer is not null and atomic_recipient is not null)),
  add constraint atomic_score_confirmed_id check (
    issuance_mode <> 'atomic' or token_id is null
    or (expected_token_id is not null and token_id = expected_token_id));

-- 此队列只有一个 OP ScoreNFT 序列；更换 issuer 也不能同时预留第二个编号。
create unique index score_atomic_single_reservation on public.score_nft_queue ((true))
  where issuance_mode = 'atomic' and expected_token_id is not null and token_id is null;

create function public.protect_atomic_score_reservation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.issuance_mode is distinct from old.issuance_mode
    or (old.expected_token_id is not null and
      (new.atomic_issuer, new.atomic_recipient, new.expected_token_id) is distinct from
      (old.atomic_issuer, old.atomic_recipient, old.expected_token_id))
    or (old.issuance_mode = 'atomic' and old.token_id is not null and new.token_id is distinct from old.token_id)
    then raise exception 'IMMUTABLE_ATOMIC_SCORE_RESERVATION'; end if;
  return new;
end; $$;
create trigger score_atomic_reservation_immutable before update on public.score_nft_queue
  for each row execute function public.protect_atomic_score_reservation();

create function public.reserve_atomic_score(
  p_queue_id uuid, p_owner uuid, p_issuer text, p_recipient text, p_expected_token_id bigint
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_row public.score_nft_queue; v_updated integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(230064);
  -- 切换时先停止新预留，待旧入口权限撤销后才打开。
  if not exists (select 1 from public.system_kv where key = 'score-atomic:enabled' and value = 'true') then return false; end if;
  select * into v_row from public.score_nft_queue where id = p_queue_id for update;
  if v_row.locked_by is distinct from p_owner or v_row.lease_expires_at <= now()
    or v_row.issuance_mode <> 'atomic' or v_row.tx_hash is not null
    or v_row.mint_attempted_at is not null or v_row.token_id is not null then return false; end if;
  if v_row.expected_token_id is not null then return true; end if;
  if exists (select 1 from public.score_nft_queue where issuance_mode = 'atomic'
    and expected_token_id is not null and token_id is null) then return false; end if;
  if exists (select 1 from public.score_nft_queue where issuance_mode = 'legacy' and token_id is null
    and (status not in ('success','failed') or tx_hash is not null or mint_attempted_at is not null)) then return false; end if;
  update public.score_nft_queue set atomic_issuer = p_issuer, atomic_recipient = p_recipient,
    expected_token_id = p_expected_token_id, updated_at = now() where id = p_queue_id
    and locked_by = p_owner and lease_expires_at > now();
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end; $$;
revoke all on function public.reserve_atomic_score(uuid,uuid,text,text,bigint) from public, anon, authenticated;
grant execute on function public.reserve_atomic_score(uuid,uuid,text,text,bigint) to service_role;

create or replace function public.claim_score_queue_job(p_owner uuid, p_lease_minutes integer default 5)
returns setof public.score_nft_queue language plpgsql security definer set search_path = '' as $$
begin
  if p_owner is null or p_lease_minutes <> 5 then raise exception 'Score lease owner is required and lease must be 5 minutes'; end if;
  return query update public.score_nft_queue q set locked_by = p_owner,
    lease_expires_at = now() + interval '5 minutes', updated_at = now()
  where q.id = (select c.id from public.score_nft_queue c
    where c.status in ('pending','uploading_events','preparing_package','minting_onchain',
      'uploading_metadata','setting_uri','finalizing_snapshot') and c.retry_count < 3
      and (c.lease_expires_at is null or c.lease_expires_at < now())
    order by (c.issuance_mode = 'atomic' and c.expected_token_id is not null and c.token_id is null) desc,
      c.created_at asc limit 1 for update skip locked) returning q.*;
end; $$;
notify pgrst, 'reload schema';
commit;
