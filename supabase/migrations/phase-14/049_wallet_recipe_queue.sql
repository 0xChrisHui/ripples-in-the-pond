-- P14：钱包终身资格、可恢复空投队列与 Arweave 上传账本。
-- activation/cursor 只能由发布 Gate 初始化；本 migration 不猜链头。

create table if not exists public.wallet_recipe_queue (
  id uuid primary key default gen_random_uuid(),
  chain_id bigint not null check (chain_id in (10, 11155420)),
  source_score_contract text not null check (source_score_contract ~ '^0x[0-9a-f]{40}$'),
  p14_contract text check (p14_contract is null or p14_contract ~ '^0x[0-9a-f]{40}$'),
  origin_wallet_key text not null check (origin_wallet_key ~ '^0x[0-9a-f]{40}$'),
  origin_wallet text not null check (origin_wallet ~ '^0x[0-9A-Fa-f]{40}$'),
  eligibility text not null check (eligibility in ('excluded_prelaunch', 'eligible')),
  source_score_queue_id uuid references public.score_nft_queue(id) on delete restrict,
  source_score_token_id bigint not null check (source_score_token_id > 0),
  source_score_tx_hash text not null check (source_score_tx_hash ~ '^0x[0-9a-f]{64}$'),
  source_score_log_index integer not null check (source_score_log_index >= 0),
  source_score_block bigint not null check (source_score_block >= 0),
  recipe_version smallint,
  recipe text,
  recipe_hash text,
  image_ar_tx_id text check (image_ar_tx_id is null or image_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'),
  metadata_ar_tx_id text check (metadata_ar_tx_id is null or metadata_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'),
  metadata_sha256 text check (metadata_sha256 is null or metadata_sha256 ~ '^[0-9a-f]{64}$'),
  metadata_upload_state text not null default 'none' check (metadata_upload_state in (
    'none', 'uploading', 'uploaded', 'verified', 'upload_result_unknown'
  )),
  token_uri text check (token_uri is null or token_uri ~ '^ar://[A-Za-z0-9_-]{43}$'),
  token_id bigint check (token_id is null or token_id > 0),
  tx_hash text check (tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'),
  mint_attempted_at timestamptz,
  status text not null check (status in (
    'excluded_prelaunch', 'pending', 'preparing_media', 'uploading_metadata',
    'minting_onchain', 'confirming_onchain', 'safe_retry', 'manual_review', 'success'
  )),
  retry_count smallint not null default 0 check (retry_count between 0 and 5),
  retry_resume_status text check (retry_resume_status is null or retry_resume_status in (
    'pending', 'preparing_media', 'uploading_metadata', 'minting_onchain', 'confirming_onchain'
  )),
  next_retry_at timestamptz,
  failure_kind text check (failure_kind is null or failure_kind in (
    'transient', 'safe_retry', 'manual_review', 'contract_rejected', 'permanent_input'
  )),
  last_error text check (last_error is null or length(last_error) <= 2000),
  locked_by uuid,
  lease_expires_at timestamptz,
  alerted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_recipe_identity_unique unique (chain_id, source_score_contract, origin_wallet_key),
  constraint wallet_recipe_source_log_unique unique (
    chain_id, source_score_contract, source_score_tx_hash, source_score_log_index
  ),
  constraint wallet_recipe_eligibility_shape check (
    (eligibility = 'excluded_prelaunch' and status = 'excluded_prelaunch'
      and recipe_version is null and recipe is null and recipe_hash is null)
    or (eligibility = 'eligible' and recipe_version = 1
      and recipe ~ '^[A-Z0-9]{36}$' and recipe_hash ~ '^[0-9a-f]{64}$'
      and status <> 'excluded_prelaunch')
  ),
  constraint wallet_recipe_retry_shape check (
    (status = 'safe_retry' and retry_resume_status is not null and next_retry_at is not null
      and failure_kind = 'safe_retry')
    or (status <> 'safe_retry' and retry_resume_status is null and next_retry_at is null)
  ),
  constraint wallet_recipe_upload_shape check (
    metadata_upload_state = 'none'
    or (metadata_sha256 is not null
      and (metadata_upload_state not in ('uploaded', 'verified') or metadata_ar_tx_id is not null))
  ),
  constraint wallet_recipe_unknown_shape check (
    metadata_upload_state <> 'upload_result_unknown' or status = 'manual_review'
  ),
  constraint wallet_recipe_chain_shape check (
    status not in ('minting_onchain', 'confirming_onchain', 'success')
    or (p14_contract is not null and metadata_upload_state = 'verified')
  ),
  constraint wallet_recipe_success_shape check (
    status <> 'success' or (metadata_ar_tx_id is not null and metadata_sha256 is not null
      and token_uri is not null and token_id is not null and tx_hash is not null
      and mint_attempted_at is not null)
  ),
  constraint wallet_recipe_lease_shape check (
    (locked_by is null and lease_expires_at is null)
    or (locked_by is not null and lease_expires_at is not null)
  ),
  constraint wallet_recipe_terminal_lease_shape check (
    status not in ('excluded_prelaunch', 'manual_review', 'success')
    or (locked_by is null and lease_expires_at is null)
  )
);

create unique index if not exists wallet_recipe_queue_source_queue_unique
  on public.wallet_recipe_queue (chain_id, source_score_contract, source_score_queue_id)
  where source_score_queue_id is not null;
create unique index if not exists wallet_recipe_queue_token_unique
  on public.wallet_recipe_queue (chain_id, p14_contract, token_id) where token_id is not null;
create index if not exists wallet_recipe_queue_claim_idx
  on public.wallet_recipe_queue (status, next_retry_at, created_at)
  where status in ('pending', 'preparing_media', 'uploading_metadata', 'minting_onchain',
    'confirming_onchain', 'safe_retry');

create table if not exists public.arweave_upload_ledger (
  id uuid primary key default gen_random_uuid(),
  chain_id bigint not null check (chain_id in (10, 11155420)),
  kind text not null check (kind in (
    'clip', 'clip_manifest', 'decoder', 'image', 'collection_metadata', 'metadata'
  )),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  queue_id uuid references public.wallet_recipe_queue(id) on delete restrict,
  state text not null check (state in ('uploading', 'uploaded', 'verified', 'upload_result_unknown')),
  arweave_tx_id text check (arweave_tx_id is null or arweave_tx_id ~ '^[A-Za-z0-9_-]{43}$'),
  attempted_at timestamptz not null default now(),
  verified_at timestamptz,
  last_error text check (last_error is null or length(last_error) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain_id, kind, content_sha256),
  constraint arweave_ledger_queue_shape check (
    (kind = 'metadata' and queue_id is not null)
    or (kind <> 'metadata' and queue_id is null)
  ),
  constraint arweave_ledger_tx_shape check (
    state not in ('uploaded', 'verified') or arweave_tx_id is not null
  ),
  constraint arweave_ledger_verified_shape check (
    (state = 'verified' and verified_at is not null)
    or (state <> 'verified' and verified_at is null)
  )
);

create or replace function public.claim_wallet_recipe_job(p_owner uuid, p_lease_minutes integer default 5)
returns setof public.wallet_recipe_queue language plpgsql security definer set search_path = '' as $$
begin
  if p_owner is null or p_lease_minutes <> 5 then
    raise exception 'P14 lease owner is required and lease must be 5 minutes';
  end if;
  return query
  update public.wallet_recipe_queue q set
    status = case when q.status = 'safe_retry' then q.retry_resume_status else q.status end,
    retry_resume_status = null, next_retry_at = null, locked_by = p_owner,
    lease_expires_at = now() + interval '5 minutes', updated_at = now()
  where q.id = (
    select c.id from public.wallet_recipe_queue c
    where c.status in ('pending', 'preparing_media', 'uploading_metadata', 'minting_onchain',
      'confirming_onchain', 'safe_retry')
      and (c.next_retry_at is null or c.next_retry_at <= now())
      and (c.lease_expires_at is null or c.lease_expires_at < now())
    order by c.created_at, c.id limit 1 for update skip locked
  ) returning q.*;
end;
$$;

create or replace function public.finish_wallet_recipe_job(
  p_id uuid, p_owner uuid, p_expected_status text, p_next_status text,
  p_failure_kind text default null, p_last_error text default null
) returns setof public.wallet_recipe_queue language plpgsql security definer set search_path = '' as $$
begin
  if p_id is null or p_owner is null or p_expected_status is null or p_next_status is null
    or not (p_next_status = p_expected_status or p_next_status in ('safe_retry', 'manual_review')
    or (p_expected_status = 'pending' and p_next_status = 'preparing_media')
    or (p_expected_status = 'preparing_media' and p_next_status = 'uploading_metadata')
    or (p_expected_status = 'uploading_metadata' and p_next_status = 'minting_onchain')
    or (p_expected_status = 'minting_onchain' and p_next_status = 'confirming_onchain')
    or (p_expected_status = 'confirming_onchain' and p_next_status = 'success')) then
    raise exception 'Invalid P14 transition: % -> %', p_expected_status, p_next_status;
  end if;
  return query
  update public.wallet_recipe_queue q set
    status = case when p_next_status = 'safe_retry' and q.retry_count = 5
      then 'manual_review' else p_next_status end,
    retry_count = case when p_next_status = 'safe_retry' and q.retry_count < 5
      then q.retry_count + 1 else q.retry_count end,
    retry_resume_status = case when p_next_status = 'safe_retry' and q.retry_count < 5
      then p_expected_status else null end,
    next_retry_at = case when p_next_status = 'safe_retry' and q.retry_count < 5 then now() +
      case q.retry_count when 0 then interval '1 minute' when 1 then interval '2 minutes'
        when 2 then interval '5 minutes' when 3 then interval '15 minutes'
        else interval '30 minutes' end else null end,
    failure_kind = case when p_next_status = 'safe_retry' and q.retry_count = 5
      then 'manual_review' when p_next_status = 'safe_retry' then 'safe_retry'
      when p_next_status = 'manual_review' then coalesce(p_failure_kind, 'manual_review')
      else p_failure_kind end,
    last_error = left(p_last_error, 2000), locked_by = null, lease_expires_at = null,
    updated_at = now()
  where q.id = p_id and q.locked_by = p_owner and q.status = p_expected_status
    and q.lease_expires_at > now()
  returning q.*;
end;
$$;

create or replace function public.register_wallet_recipe_origin(
  p_chain_id bigint, p_source_score_contract text, p_origin_wallet text,
  p_source_score_queue_id uuid, p_source_score_token_id bigint, p_source_score_tx_hash text,
  p_source_score_log_index integer, p_source_score_block bigint, p_recipe text,
  p_recipe_hash text, p_expected_cursor text
) returns setof public.wallet_recipe_queue language plpgsql security definer set search_path = '' as $$
declare
  v_contract text := lower(p_source_score_contract);
  v_origin_key text := lower(p_origin_wallet);
  v_activation_text text;
  v_cursor text;
  v_eligibility text;
  v_row public.wallet_recipe_queue%rowtype;
begin
  if p_chain_id is null or p_source_score_contract is null or p_origin_wallet is null
    or p_source_score_token_id is null or p_source_score_tx_hash is null
    or p_source_score_log_index is null or p_source_score_block is null
    or p_expected_cursor is null or p_chain_id not in (10, 11155420)
    or v_contract !~ '^0x[0-9a-f]{40}$'
    or p_origin_wallet !~ '^0x[0-9A-Fa-f]{40}$'
    or v_origin_key = '0x0000000000000000000000000000000000000000'
    or p_source_score_token_id <= 0 or lower(p_source_score_tx_hash) !~ '^0x[0-9a-f]{64}$'
    or p_source_score_log_index < 0 or p_source_score_block < 0
    or p_expected_cursor !~ '^[0-9]+:-?[0-9]+$' then
    raise exception 'Invalid P14 source event';
  end if;
  select k.value into v_activation_text from public.system_kv k
    where k.key = 'p14:activation:' || p_chain_id || ':' || v_contract;
  if v_activation_text is null or v_activation_text !~ '^[0-9]+$' then
    raise exception 'P14 activationBlock missing or invalid';
  end if;
  v_eligibility := case when p_source_score_block <= v_activation_text::bigint
    then 'excluded_prelaunch' else 'eligible' end;
  select k.value into v_cursor from public.system_kv k
    where k.key = 'p14:cursor:' || p_chain_id || ':' || v_contract for update;
  if v_cursor is null or v_cursor !~ '^[0-9]+:-?[0-9]+$' then
    raise exception 'P14 discovery cursor missing or invalid';
  end if;
  select q.* into v_row from public.wallet_recipe_queue q
    where q.chain_id = p_chain_id and q.source_score_contract = v_contract
      and q.source_score_tx_hash = lower(p_source_score_tx_hash)
      and q.source_score_log_index = p_source_score_log_index;
  if found then
    if v_row.origin_wallet_key is distinct from v_origin_key
      or v_row.source_score_queue_id is distinct from p_source_score_queue_id
      or v_row.source_score_token_id is distinct from p_source_score_token_id
      or v_row.source_score_block is distinct from p_source_score_block
      or v_row.eligibility is distinct from v_eligibility
      or (v_eligibility = 'eligible' and (v_row.recipe is distinct from p_recipe
        or v_row.recipe_hash is distinct from p_recipe_hash)) then
      raise exception 'P14 replay evidence changed';
    end if;
    return next v_row;
    return;
  end if;
  if v_cursor is distinct from p_expected_cursor then
    raise exception 'P14 discovery cursor conflict';
  end if;
  if (p_source_score_block, p_source_score_log_index) <=
    (split_part(v_cursor, ':', 1)::bigint, split_part(v_cursor, ':', 2)::integer) then
    raise exception 'P14 source event must follow the cursor';
  end if;
  if v_eligibility = 'eligible'
    and (p_recipe !~ '^[A-Z0-9]{36}$' or p_recipe_hash !~ '^[0-9a-f]{64}$') then
    raise exception 'Invalid P14 recipe';
  end if;
  insert into public.wallet_recipe_queue (
    chain_id, source_score_contract, origin_wallet_key, origin_wallet, eligibility,
    source_score_queue_id, source_score_token_id, source_score_tx_hash,
    source_score_log_index, source_score_block, recipe_version, recipe, recipe_hash, status
  ) values (
    p_chain_id, v_contract, v_origin_key, p_origin_wallet, v_eligibility,
    p_source_score_queue_id, p_source_score_token_id, lower(p_source_score_tx_hash),
    p_source_score_log_index, p_source_score_block,
    case when v_eligibility = 'eligible' then 1 end,
    case when v_eligibility = 'eligible' then p_recipe end,
    case when v_eligibility = 'eligible' then p_recipe_hash end,
    case when v_eligibility = 'eligible' then 'pending' else 'excluded_prelaunch' end
  ) on conflict (chain_id, source_score_contract, origin_wallet_key) do nothing;
  select q.* into v_row from public.wallet_recipe_queue q where q.chain_id = p_chain_id
    and q.source_score_contract = v_contract and q.origin_wallet_key = v_origin_key;
  if (v_row.source_score_block, v_row.source_score_log_index) >
    (p_source_score_block, p_source_score_log_index) then
    raise exception 'P14 earlier source arrived after a later source';
  end if;
  if (v_row.source_score_block, v_row.source_score_log_index) =
    (p_source_score_block, p_source_score_log_index)
    and (v_row.source_score_tx_hash is distinct from lower(p_source_score_tx_hash)
      or v_row.source_score_token_id is distinct from p_source_score_token_id
      or v_row.eligibility is distinct from v_eligibility
      or (v_eligibility = 'eligible' and (v_row.recipe is distinct from p_recipe
        or v_row.recipe_hash is distinct from p_recipe_hash))) then
    raise exception 'P14 replay evidence changed';
  end if;
  update public.system_kv set value = p_source_score_block || ':' || p_source_score_log_index,
    updated_at = now() where key = 'p14:cursor:' || p_chain_id || ':' || v_contract
      and value = p_expected_cursor;
  return next v_row;
end;
$$;

create or replace function public.claim_wallet_recipe_metadata_upload(
  p_queue_id uuid, p_owner uuid, p_content_sha256 text
) returns table (ledger_id uuid, upload_state text, arweave_tx_id text, claimed boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.wallet_recipe_queue%rowtype;
  v_ledger public.arweave_upload_ledger%rowtype;
  v_inserted uuid;
begin
  select q.* into v_job from public.wallet_recipe_queue q where q.id = p_queue_id
    and q.locked_by = p_owner and q.lease_expires_at > now()
    and q.status = 'uploading_metadata' for update;
  if not found or p_content_sha256 is null
    or p_content_sha256 !~ '^[0-9a-f]{64}$' then return; end if;
  if v_job.metadata_sha256 is not null and v_job.metadata_sha256 <> p_content_sha256 then
    update public.wallet_recipe_queue q set status = 'manual_review',
      failure_kind = 'manual_review', last_error = 'metadata content hash changed',
      locked_by = null, lease_expires_at = null, updated_at = now() where q.id = p_queue_id;
    return;
  end if;
  insert into public.arweave_upload_ledger (chain_id, kind, content_sha256, queue_id, state)
    values (v_job.chain_id, 'metadata', p_content_sha256, p_queue_id, 'uploading')
    on conflict (chain_id, kind, content_sha256) do nothing returning id into v_inserted;
  select l.* into v_ledger from public.arweave_upload_ledger l
    where l.chain_id = v_job.chain_id and l.kind = 'metadata'
      and l.content_sha256 = p_content_sha256 for update;
  -- 旧 worker 可能在 Turbo 已收件但尚未回写 txid 时退出；过期后只能转人工核对，
  -- 绝不能把没有 txid 的 uploading 当成“未上传”并再次扣费。
  if v_inserted is null and v_ledger.state = 'uploading'
    and v_ledger.attempted_at <= now() - interval '5 minutes' then
    update public.arweave_upload_ledger l set state = 'upload_result_unknown',
      last_error = 'metadata upload lease expired before txid was durably recorded',
      updated_at = now() where l.id = v_ledger.id returning l.* into v_ledger;
  end if;
  update public.wallet_recipe_queue q set metadata_sha256 = p_content_sha256,
    metadata_upload_state = v_ledger.state,
    metadata_ar_tx_id = coalesce(v_ledger.arweave_tx_id, q.metadata_ar_tx_id),
    token_uri = case when v_ledger.state = 'verified'
      then 'ar://' || v_ledger.arweave_tx_id else q.token_uri end,
    status = case when v_ledger.state = 'upload_result_unknown' then 'manual_review' else q.status end,
    failure_kind = case when v_ledger.state = 'upload_result_unknown' then 'manual_review' else q.failure_kind end,
    locked_by = case when v_ledger.state = 'upload_result_unknown' then null else q.locked_by end,
    lease_expires_at = case when v_ledger.state = 'upload_result_unknown' then null else q.lease_expires_at end,
    updated_at = now() where q.id = p_queue_id;
  return query select v_ledger.id, v_ledger.state, v_ledger.arweave_tx_id,
    v_inserted is not null;
end;
$$;

create or replace function public.advance_wallet_recipe_metadata_upload(
  p_ledger_id uuid, p_queue_id uuid, p_owner uuid, p_next_state text,
  p_arweave_tx_id text default null, p_last_error text default null
) returns setof public.wallet_recipe_queue language plpgsql security definer set search_path = '' as $$
declare
  v_current_state text;
  v_current_tx_id text;
begin
  select l.state, l.arweave_tx_id into v_current_state, v_current_tx_id
    from public.arweave_upload_ledger l
    join public.wallet_recipe_queue q on q.id = l.queue_id
    where l.id = p_ledger_id and q.id = p_queue_id and q.locked_by = p_owner
      and q.lease_expires_at > now() and q.status = 'uploading_metadata' for update of l, q;
  if not found then return; end if;
  if p_next_state is null or not ((v_current_state = 'uploading'
      and p_next_state in ('uploaded', 'upload_result_unknown'))
    or (v_current_state = 'uploaded' and p_next_state = 'verified')) then
    raise exception 'Invalid P14 upload transition: % -> %', v_current_state, p_next_state;
  end if;
  if p_next_state in ('uploaded', 'verified')
    and (p_arweave_tx_id is null or p_arweave_tx_id !~ '^[A-Za-z0-9_-]{43}$') then
    raise exception 'P14 upload tx id missing or invalid';
  end if;
  if p_next_state = 'verified' and v_current_tx_id is distinct from p_arweave_tx_id then
    raise exception 'P14 upload tx id changed during verification';
  end if;
  update public.arweave_upload_ledger l set state = p_next_state,
    arweave_tx_id = coalesce(p_arweave_tx_id, l.arweave_tx_id),
    verified_at = case when p_next_state = 'verified' then now() end,
    last_error = left(p_last_error, 2000), updated_at = now() where l.id = p_ledger_id;
  return query update public.wallet_recipe_queue q set metadata_upload_state = p_next_state,
    metadata_ar_tx_id = coalesce(p_arweave_tx_id, q.metadata_ar_tx_id),
    token_uri = case when p_next_state = 'verified'
      then 'ar://' || coalesce(p_arweave_tx_id, q.metadata_ar_tx_id) else q.token_uri end,
    status = case when p_next_state = 'upload_result_unknown' then 'manual_review' else q.status end,
    failure_kind = case when p_next_state = 'upload_result_unknown' then 'manual_review' else q.failure_kind end,
    last_error = left(p_last_error, 2000),
    locked_by = case when p_next_state = 'upload_result_unknown' then null else q.locked_by end,
    lease_expires_at = case when p_next_state = 'upload_result_unknown' then null else q.lease_expires_at end,
    updated_at = now() where q.id = p_queue_id returning q.*;
end;
$$;

alter table public.wallet_recipe_queue enable row level security;
alter table public.arweave_upload_ledger enable row level security;
revoke all on table public.wallet_recipe_queue, public.arweave_upload_ledger from public, anon, authenticated;
revoke all on function public.claim_wallet_recipe_job(uuid, integer) from public, anon, authenticated;
revoke all on function public.finish_wallet_recipe_job(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.register_wallet_recipe_origin(
  bigint, text, text, uuid, bigint, text, integer, bigint, text, text, text
) from public, anon, authenticated;
revoke all on function public.claim_wallet_recipe_metadata_upload(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.advance_wallet_recipe_metadata_upload(
  uuid, uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.claim_wallet_recipe_job(uuid, integer) to service_role;
grant execute on function public.finish_wallet_recipe_job(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.register_wallet_recipe_origin(
  bigint, text, text, uuid, bigint, text, integer, bigint, text, text, text
) to service_role;
grant execute on function public.claim_wallet_recipe_metadata_upload(uuid, uuid, text) to service_role;
grant execute on function public.advance_wallet_recipe_metadata_upload(
  uuid, uuid, uuid, text, text, text
) to service_role;
