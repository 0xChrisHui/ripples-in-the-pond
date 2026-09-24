-- P16-D：资产 worker、凭证 attempt/submission 与对账的原子状态转换。

create or replace function public.claim_score_self_mint_asset_job(
  p_owner uuid, p_lease_minutes integer default 5
)
returns setof public.score_self_mint_orders
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_lease_minutes < 1 or p_lease_minutes > 15 then raise exception 'INVALID_LEASE'; end if;
  select id into v_id from public.score_self_mint_orders
  where status = 'preparing_assets'
    and (lease_expires_at is null or lease_expires_at < now())
  order by created_at for update skip locked limit 1;
  if v_id is null then return; end if;
  return query update public.score_self_mint_orders set
    locked_by = p_owner, lease_expires_at = now() + make_interval(mins => p_lease_minutes),
    updated_at = now()
  where id = v_id returning *;
end;
$$;

create or replace function public.issue_score_self_mint_authorization(
  p_user_id uuid, p_order_id text, p_digest text, p_uri_hash text,
  p_deadline bigint, p_authorizer text
)
returns public.score_self_mint_orders
language plpgsql security definer set search_path = '' as $$
declare v_order public.score_self_mint_orders%rowtype;
begin
  if p_digest !~ '^0x[0-9a-f]{64}$' or p_uri_hash !~ '^0x[0-9a-f]{64}$'
    or p_authorizer !~ '^0x[0-9a-f]{40}$' or p_deadline <= extract(epoch from now()) then
    raise exception 'INVALID_AUTHORIZATION';
  end if;
  update public.score_self_mint_orders set
    typed_data_digest = p_digest, uri_hash = p_uri_hash, voucher_deadline = p_deadline,
    authorizer_address = p_authorizer, authorization_issued_at = now(),
    status = 'ready_to_sign', failure_stage = null, failure_code = null,
    retryable = false, last_error = null, updated_at = now()
  where order_id = p_order_id and user_id = p_user_id
    and status in ('ready_to_sign', 'expired')
    and token_uri is not null and events_upload_state = 'verified'
    and package_upload_state = 'verified' and metadata_upload_state = 'verified'
    and send_attempted_at is null and tx_hash is null
  returning * into v_order;
  if not found then raise exception 'ORDER_NOT_AUTHORIZABLE'; end if;
  return v_order;
end;
$$;

create or replace function public.mark_score_self_mint_attempt(
  p_user_id uuid, p_order_id text, p_digest text
)
returns public.score_self_mint_orders
language plpgsql security definer set search_path = '' as $$
declare v_order public.score_self_mint_orders%rowtype;
begin
  update public.score_self_mint_orders set send_attempted_at = now(), updated_at = now()
  where order_id = p_order_id and user_id = p_user_id and status = 'ready_to_sign'
    and typed_data_digest = p_digest and voucher_deadline >= extract(epoch from now())
    and send_attempted_at is null and tx_hash is null
  returning * into v_order;
  if not found then raise exception 'ATTEMPT_CONFLICT'; end if;
  return v_order;
end;
$$;

create or replace function public.resolve_score_self_mint_attempt(
  p_user_id uuid, p_order_id text, p_digest text, p_rejected boolean
)
returns public.score_self_mint_orders
language plpgsql security definer set search_path = '' as $$
declare v_order public.score_self_mint_orders%rowtype;
begin
  update public.score_self_mint_orders set
    send_attempted_at = case when p_rejected then null else send_attempted_at end,
    status = case when p_rejected then 'ready_to_sign' else 'manual_review' end,
    failure_stage = case when p_rejected then null else 'wallet_send' end,
    failure_code = case when p_rejected then null else 'HASH_UNKNOWN' end,
    retryable = false,
    last_error = case when p_rejected then null else '钱包调用结束但交易哈希未知' end,
    updated_at = now()
  where order_id = p_order_id and user_id = p_user_id and status = 'ready_to_sign'
    and typed_data_digest = p_digest and send_attempted_at is not null and tx_hash is null
  returning * into v_order;
  if not found then raise exception 'ATTEMPT_RESOLUTION_CONFLICT'; end if;
  if not p_rejected then
    update public.score_mint_claims set status = 'manual_review', updated_at = now()
    where pending_score_id = v_order.pending_score_id and mode = 'eth_self_paid'
      and status = 'active' and version = v_order.claim_version;
  end if;
  return v_order;
end;
$$;

create or replace function public.submit_score_self_mint_transaction(
  p_user_id uuid, p_order_id text, p_digest text, p_tx_hash text
)
returns public.score_self_mint_orders
language plpgsql security definer set search_path = '' as $$
declare v_order public.score_self_mint_orders%rowtype;
begin
  if p_tx_hash !~ '^0x[0-9a-f]{64}$' then raise exception 'INVALID_TX_HASH'; end if;
  update public.score_self_mint_orders set
    tx_hash = p_tx_hash, status = 'submitted', failure_stage = null,
    failure_code = null, last_error = null, updated_at = now()
  where order_id = p_order_id and user_id = p_user_id and status = 'ready_to_sign'
    and typed_data_digest = p_digest and send_attempted_at is not null
    and tx_hash is null
  returning * into v_order;
  if not found then raise exception 'SUBMISSION_CONFLICT'; end if;
  return v_order;
end;
$$;

create or replace function public.claim_score_self_mint_reconcile_job(
  p_owner uuid, p_lease_minutes integer default 5
)
returns setof public.score_self_mint_orders
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from public.score_self_mint_orders
  where (status in ('submitted', 'confirming')
      or (status = 'manual_review' and send_attempted_at is not null))
    and (lease_expires_at is null or lease_expires_at < now())
  order by last_reconciled_at nulls first, created_at for update skip locked limit 1;
  if v_id is null then return; end if;
  return query update public.score_self_mint_orders set
    locked_by = p_owner, lease_expires_at = now() + make_interval(mins => p_lease_minutes),
    last_reconciled_at = now(), updated_at = now()
  where id = v_id returning *;
end;
$$;

create or replace function public.complete_score_self_mint(
  p_order_id text, p_token_id bigint, p_tx_hash text, p_block_number bigint
)
returns public.score_self_mint_orders
language plpgsql security definer set search_path = '' as $$
declare v_order public.score_self_mint_orders%rowtype;
begin
  update public.score_self_mint_orders set
    tx_hash = coalesce(tx_hash, p_tx_hash),
    replacement_tx_hash = case when tx_hash is not null and tx_hash <> p_tx_hash then p_tx_hash else replacement_tx_hash end,
    block_number = p_block_number, confirmed_at = now(), status = 'success',
    failure_stage = null, failure_code = null, retryable = false, last_error = null,
    locked_by = null, lease_expires_at = null, updated_at = now()
  where order_id = p_order_id and token_id = p_token_id
    and status in ('ready_to_sign', 'submitted', 'confirming', 'manual_review', 'expired', 'failed')
  returning * into v_order;
  if not found then raise exception 'RECONCILE_CONFLICT'; end if;
  update public.score_mint_claims set status = 'consumed', updated_at = now()
  where pending_score_id = v_order.pending_score_id and mode = 'eth_self_paid'
    and status in ('active', 'manual_review') and version = v_order.claim_version;
  if not found then raise exception 'CLAIM_COMPLETE_CONFLICT'; end if;
  return v_order;
end;
$$;

revoke all on function public.claim_score_self_mint_asset_job(uuid, integer),
  public.issue_score_self_mint_authorization(uuid, text, text, text, bigint, text),
  public.mark_score_self_mint_attempt(uuid, text, text),
  public.resolve_score_self_mint_attempt(uuid, text, text, boolean),
  public.submit_score_self_mint_transaction(uuid, text, text, text),
  public.claim_score_self_mint_reconcile_job(uuid, integer),
  public.complete_score_self_mint(text, bigint, text, bigint)
  from public, anon, authenticated;
grant execute on function public.claim_score_self_mint_asset_job(uuid, integer),
  public.issue_score_self_mint_authorization(uuid, text, text, text, bigint, text),
  public.mark_score_self_mint_attempt(uuid, text, text),
  public.resolve_score_self_mint_attempt(uuid, text, text, boolean),
  public.submit_score_self_mint_transaction(uuid, text, text, text),
  public.claim_score_self_mint_reconcile_job(uuid, integer),
  public.complete_score_self_mint(text, bigint, text, bigint) to service_role;
