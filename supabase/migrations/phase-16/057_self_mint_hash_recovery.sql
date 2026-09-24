-- P16-D/F：冻结 v3 pin、记录不可盲重传的上传状态，并支持同一交易哈希幂等补登。

create table public.score_self_mint_upload_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.score_self_mint_orders(id) on delete restrict,
  kind text not null check (kind in ('events', 'package', 'metadata')),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  bytes bigint not null check (bytes > 0),
  mime text not null check (mime = 'application/json'),
  state text not null check (state in ('uploading', 'uploaded', 'verified', 'upload_result_unknown')),
  arweave_tx_id text check (arweave_tx_id is null or arweave_tx_id ~ '^[A-Za-z0-9_-]{43}$'),
  attempted_at timestamptz not null default now(),
  verified_at timestamptz,
  last_error text check (last_error is null or length(last_error) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, kind),
  constraint score_self_upload_package_size check (kind <> 'package' or bytes <= 65536),
  constraint score_self_upload_tx_shape check (state not in ('uploaded', 'verified') or arweave_tx_id is not null),
  constraint score_self_upload_verified_shape check (
    (state = 'verified' and verified_at is not null) or (state <> 'verified' and verified_at is null)
  )
);

create function public.protect_score_self_mint_pins() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.track_id, new.sound_set_id, new.sounds_map_ar_tx_id, new.sounds_map_sha256,
      new.sounds_map_bytes, new.sounds_map_mime, new.decoder_id, new.decoder_ar_tx_id,
      new.decoder_sha256, new.decoder_bytes, new.decoder_mime, new.base_ar_tx_id,
      new.base_sha256, new.base_bytes, new.base_mime) is distinct from
     (old.track_id, old.sound_set_id, old.sounds_map_ar_tx_id, old.sounds_map_sha256,
      old.sounds_map_bytes, old.sounds_map_mime, old.decoder_id, old.decoder_ar_tx_id,
      old.decoder_sha256, old.decoder_bytes, old.decoder_mime, old.base_ar_tx_id,
      old.base_sha256, old.base_bytes, old.base_mime) then
    raise exception 'IMMUTABLE_PERMANENT_RECORD: score_self_mint_orders pins';
  end if;
  return new;
end;
$$;
create trigger score_self_mint_pins_immutable before update on public.score_self_mint_orders
for each row execute function public.protect_score_self_mint_pins();

create function public.protect_score_self_mint_upload() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'IMMUTABLE_PERMANENT_RECORD: self mint upload ledger'; end if;
  if (new.order_id, new.kind, new.content_sha256, new.bytes, new.mime) is distinct from
     (old.order_id, old.kind, old.content_sha256, old.bytes, old.mime) then
    raise exception 'IMMUTABLE_PERMANENT_RECORD: self mint upload identity';
  end if;
  if old.arweave_tx_id is not null and new.arweave_tx_id is distinct from old.arweave_tx_id then
    raise exception 'IMMUTABLE_PERMANENT_RECORD: self mint upload txid';
  end if;
  if old.state = 'verified' and new is distinct from old then
    raise exception 'IMMUTABLE_PERMANENT_RECORD: verified self mint upload';
  end if;
  if new.state is distinct from old.state and not (
    (old.state = 'uploading' and new.state in ('uploaded', 'upload_result_unknown'))
    or (old.state = 'uploaded' and new.state = 'verified')
    or (old.state = 'upload_result_unknown' and new.state in ('uploaded', 'verified'))
  ) then raise exception 'INVALID_SELF_MINT_UPLOAD_TRANSITION: % -> %', old.state, new.state;
  end if;
  return new;
end;
$$;
create trigger score_self_mint_upload_protected before update or delete
on public.score_self_mint_upload_ledger for each row execute function public.protect_score_self_mint_upload();

create function public.write_score_self_mint_upload_state(
  p_order_id uuid, p_lease_owner uuid, p_kind text, p_content_sha256 text,
  p_bytes bigint, p_mime text, p_state text, p_arweave_tx_id text,
  p_last_error text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz := now(); v_updated integer;
begin
  if p_kind = 'events' then
    update public.score_self_mint_orders set events_sha256 = p_content_sha256,
      events_bytes = p_bytes, events_mime = p_mime, events_upload_state = p_state,
      events_ar_tx_id = p_arweave_tx_id,
      events_verified_at = case when p_state = 'verified' then v_now else null end,
      updated_at = v_now where id = p_order_id and locked_by = p_lease_owner and lease_expires_at > v_now;
  elsif p_kind = 'package' then
    update public.score_self_mint_orders set package_sha256 = p_content_sha256,
      package_bytes = p_bytes, package_mime = p_mime, package_upload_state = p_state,
      package_ar_tx_id = p_arweave_tx_id,
      package_verified_at = case when p_state = 'verified' then v_now else null end,
      updated_at = v_now where id = p_order_id and locked_by = p_lease_owner and lease_expires_at > v_now;
  elsif p_kind = 'metadata' then
    update public.score_self_mint_orders set metadata_sha256 = p_content_sha256,
      metadata_bytes = p_bytes, metadata_mime = p_mime, metadata_upload_state = p_state,
      metadata_ar_tx_id = p_arweave_tx_id,
      metadata_verified_at = case when p_state = 'verified' then v_now else null end,
      token_uri = case when p_state = 'verified' then 'ar://' || p_arweave_tx_id else token_uri end,
      updated_at = v_now where id = p_order_id and locked_by = p_lease_owner and lease_expires_at > v_now;
  else raise exception 'INVALID_SELF_MINT_UPLOAD_KIND: %', p_kind;
  end if;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return false; end if;

  insert into public.score_self_mint_upload_ledger (
    order_id, kind, content_sha256, bytes, mime, state, arweave_tx_id, verified_at, last_error, updated_at
  ) values (
    p_order_id, p_kind, p_content_sha256, p_bytes, p_mime, p_state, p_arweave_tx_id,
    case when p_state = 'verified' then v_now else null end, p_last_error, v_now
  ) on conflict (order_id, kind) do update set
    state = excluded.state, arweave_tx_id = excluded.arweave_tx_id,
    verified_at = excluded.verified_at, last_error = excluded.last_error, updated_at = excluded.updated_at;
  return true;
end;
$$;

create or replace function public.submit_score_self_mint_transaction(
  p_user_id uuid, p_order_id text, p_digest text, p_tx_hash text
) returns public.score_self_mint_orders
language plpgsql security definer set search_path = '' as $$
declare v_order public.score_self_mint_orders%rowtype;
begin
  if p_tx_hash !~ '^0x[0-9a-f]{64}$' then raise exception 'INVALID_TX_HASH'; end if;
  select * into v_order from public.score_self_mint_orders
  where order_id = p_order_id and user_id = p_user_id for update;
  if not found or v_order.typed_data_digest <> p_digest then raise exception 'SUBMISSION_CONFLICT'; end if;
  if v_order.tx_hash = p_tx_hash and v_order.status in ('submitted', 'confirming', 'success') then return v_order; end if;
  if v_order.status not in ('ready_to_sign', 'manual_review')
    or v_order.send_attempted_at is null or v_order.tx_hash is not null then
    raise exception 'SUBMISSION_CONFLICT';
  end if;
  update public.score_self_mint_orders set tx_hash = p_tx_hash, status = 'submitted',
    failure_stage = null, failure_code = null, last_error = null, updated_at = now()
  where id = v_order.id returning * into v_order;
  return v_order;
end;
$$;

alter table public.score_self_mint_upload_ledger enable row level security;
revoke all on public.score_self_mint_upload_ledger from public, anon, authenticated;
grant select, insert, update on public.score_self_mint_upload_ledger to service_role;
revoke all on function public.write_score_self_mint_upload_state(
  uuid, uuid, text, text, bigint, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.submit_score_self_mint_transaction(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.write_score_self_mint_upload_state(
  uuid, uuid, text, text, bigint, text, text, text, text
) to service_role;
grant execute on function public.submit_score_self_mint_transaction(uuid, text, text, text) to service_role;
