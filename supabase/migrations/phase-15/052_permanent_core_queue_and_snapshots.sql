-- P15-H2：把永久依赖固定在入队事务内，并建立可恢复上传与不可变播放快照。
-- 本 migration 只建结构；永久资源注册与 active 指针由 H3/H7 的发布 Gate 写入。

create table public.permanent_sound_sets (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9._-]{2,79}$'),
  sounds_map_ar_tx_id text not null unique check (sounds_map_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'),
  sounds_map_sha256 text not null check (sounds_map_sha256 ~ '^[0-9a-f]{64}$'),
  sounds_map_bytes bigint not null check (sounds_map_bytes between 1 and 65536),
  sounds_map_mime text not null check (sounds_map_mime = 'application/json'),
  key_count smallint not null check (key_count = 33),
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (sounds_map_sha256, sounds_map_bytes),
  unique (id, sounds_map_ar_tx_id, sounds_map_sha256, sounds_map_bytes, sounds_map_mime)
);

create table public.permanent_decoders (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9._-]{2,79}$'),
  ar_tx_id text not null unique check (ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  bytes bigint not null check (bytes > 0),
  mime text not null check (mime = 'text/html'),
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (sha256, bytes),
  unique (id, ar_tx_id, sha256, bytes, mime)
);

-- 单例指针允许 H7 原子切换未来任务；已入队任务只读自身 pin，不再跟随此指针。
create table public.permanent_core_active (
  singleton boolean primary key default true check (singleton),
  sound_set_id text not null references public.permanent_sound_sets(id) on delete restrict,
  decoder_id text not null references public.permanent_decoders(id) on delete restrict,
  activated_at timestamptz not null default now()
);

alter table public.tracks
  add column base_ar_tx_id text,
  add column base_sha256 text,
  add column base_bytes bigint,
  add column base_mime text,
  add column base_verified_at timestamptz,
  add constraint tracks_permanent_base_shape check (
    (base_ar_tx_id is null and base_sha256 is null and base_bytes is null
      and base_mime is null and base_verified_at is null)
    or (base_ar_tx_id is not null and base_sha256 is not null and base_bytes is not null
      and base_mime is not null and base_verified_at is not null
      and base_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'
      and base_sha256 ~ '^[0-9a-f]{64}$' and base_bytes > 0
      and base_mime = 'audio/mpeg' and base_verified_at is not null)
  ),
  add constraint tracks_permanent_base_identity_unique
    unique (id, base_ar_tx_id, base_sha256, base_bytes, base_mime);

alter table public.score_nft_queue
  add column sound_set_id text references public.permanent_sound_sets(id) on delete restrict,
  add column sounds_map_ar_tx_id text,
  add column sounds_map_sha256 text,
  add column sounds_map_bytes bigint,
  add column sounds_map_mime text,
  add column decoder_id text references public.permanent_decoders(id) on delete restrict,
  add column decoder_ar_tx_id text,
  add column decoder_sha256 text,
  add column decoder_bytes bigint,
  add column decoder_mime text,
  add column base_ar_tx_id text,
  add column base_sha256 text,
  add column base_bytes bigint,
  add column base_mime text,
  add column requires_package_v3 boolean not null default false,
  add column events_sha256 text,
  add column events_bytes bigint,
  add column events_mime text,
  add column events_upload_state text not null default 'none',
  add column events_verified_at timestamptz,
  add column package_ar_tx_id text,
  add column package_sha256 text,
  add column package_bytes bigint,
  add column package_mime text,
  add column package_upload_state text not null default 'none',
  add column package_verified_at timestamptz,
  add column metadata_sha256 text,
  add column metadata_bytes bigint,
  add column metadata_mime text,
  add column metadata_upload_state text not null default 'none',
  add column metadata_verified_at timestamptz;

alter table public.score_nft_queue
  drop constraint if exists score_nft_queue_status_check;
alter table public.score_nft_queue
  add constraint score_nft_queue_status_check check (status in (
    'pending', 'uploading_events', 'preparing_package', 'minting_onchain',
    'uploading_metadata', 'setting_uri', 'finalizing_snapshot', 'success', 'failed'
  ));

alter table public.score_nft_queue
  add constraint score_queue_permanent_pin_shape check (
    (sound_set_id is null and sounds_map_ar_tx_id is null and sounds_map_sha256 is null
      and sounds_map_bytes is null and sounds_map_mime is null and decoder_id is null
      and decoder_ar_tx_id is null and decoder_sha256 is null and decoder_bytes is null
      and decoder_mime is null and base_ar_tx_id is null and base_sha256 is null
      and base_bytes is null and base_mime is null)
    or (sound_set_id is not null and sounds_map_ar_tx_id is not null
      and sounds_map_sha256 is not null and sounds_map_bytes is not null
      and sounds_map_mime is not null and decoder_id is not null
      and decoder_ar_tx_id is not null and decoder_sha256 is not null
      and decoder_bytes is not null and decoder_mime is not null
      and base_ar_tx_id is not null and base_sha256 is not null
      and base_bytes is not null and base_mime is not null
      and sounds_map_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'
      and sounds_map_sha256 ~ '^[0-9a-f]{64}$' and sounds_map_bytes > 0
      and sounds_map_mime = 'application/json'
      and decoder_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'
      and decoder_sha256 ~ '^[0-9a-f]{64}$' and decoder_bytes > 0
      and decoder_mime = 'text/html' and base_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'
      and base_sha256 ~ '^[0-9a-f]{64}$' and base_bytes > 0 and base_mime = 'audio/mpeg')
  ),
  add constraint score_queue_events_upload_state check (events_upload_state in (
    'none', 'uploading', 'uploaded', 'verified', 'upload_result_unknown'
  )),
  add constraint score_queue_package_upload_state check (package_upload_state in (
    'none', 'uploading', 'uploaded', 'verified', 'upload_result_unknown'
  )),
  add constraint score_queue_metadata_upload_state check (metadata_upload_state in (
    'none', 'uploading', 'uploaded', 'verified', 'upload_result_unknown'
  )),
  add constraint score_queue_events_identity_shape check (
    (events_upload_state = 'none' and events_sha256 is null and events_bytes is null
      and events_mime is null and events_verified_at is null)
    or (events_upload_state <> 'none' and events_sha256 is not null
      and events_bytes is not null and events_mime is not null
      and events_sha256 ~ '^[0-9a-f]{64}$'
      and events_bytes > 0 and events_mime = 'application/json'
      and (events_upload_state not in ('uploaded', 'verified')
        or (events_ar_tx_id is not null and events_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'))
      and ((events_upload_state = 'verified' and events_verified_at is not null)
        or (events_upload_state <> 'verified' and events_verified_at is null)))
  ),
  add constraint score_queue_package_identity_shape check (
    (package_upload_state = 'none' and package_ar_tx_id is null and package_sha256 is null
      and package_bytes is null and package_mime is null and package_verified_at is null)
    or (package_upload_state <> 'none' and package_sha256 is not null
      and package_bytes is not null and package_mime is not null
      and package_sha256 ~ '^[0-9a-f]{64}$'
      and package_bytes between 1 and 65536 and package_mime = 'application/json'
      and (package_upload_state not in ('uploaded', 'verified')
        or (package_ar_tx_id is not null and package_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'))
      and ((package_upload_state = 'verified' and package_verified_at is not null)
        or (package_upload_state <> 'verified' and package_verified_at is null)))
  ),
  add constraint score_queue_metadata_identity_shape check (
    (metadata_upload_state = 'none' and metadata_sha256 is null and metadata_bytes is null
      and metadata_mime is null and metadata_verified_at is null)
    or (metadata_upload_state <> 'none' and metadata_sha256 is not null
      and metadata_bytes is not null and metadata_mime is not null
      and metadata_sha256 ~ '^[0-9a-f]{64}$'
      and metadata_bytes > 0 and metadata_mime = 'application/json'
      and (metadata_upload_state not in ('uploaded', 'verified')
        or (metadata_ar_tx_id is not null and metadata_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'))
      and ((metadata_upload_state = 'verified' and metadata_verified_at is not null)
        or (metadata_upload_state <> 'verified' and metadata_verified_at is null)))
  ),
  add constraint score_queue_package_before_mint check (
    not requires_package_v3 or status not in ('minting_onchain', 'uploading_metadata',
      'setting_uri', 'finalizing_snapshot', 'success') or package_upload_state = 'verified'
  ),
  add constraint score_queue_sound_set_identity_fk foreign key (
    sound_set_id, sounds_map_ar_tx_id, sounds_map_sha256, sounds_map_bytes, sounds_map_mime
  ) references public.permanent_sound_sets (
    id, sounds_map_ar_tx_id, sounds_map_sha256, sounds_map_bytes, sounds_map_mime
  ) on delete restrict,
  add constraint score_queue_decoder_identity_fk foreign key (
    decoder_id, decoder_ar_tx_id, decoder_sha256, decoder_bytes, decoder_mime
  ) references public.permanent_decoders (id, ar_tx_id, sha256, bytes, mime) on delete restrict,
  add constraint score_queue_base_identity_fk foreign key (
    track_id, base_ar_tx_id, base_sha256, base_bytes, base_mime
  ) references public.tracks (id, base_ar_tx_id, base_sha256, base_bytes, base_mime)
    on delete restrict;

create table public.score_arweave_upload_ledger (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.score_nft_queue(id) on delete restrict,
  kind text not null check (kind in ('events', 'package', 'metadata')),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  bytes bigint not null check (bytes > 0),
  mime text not null check (mime = 'application/json'),
  state text not null check (state in (
    'uploading', 'uploaded', 'verified', 'upload_result_unknown'
  )),
  arweave_tx_id text check (arweave_tx_id is null or arweave_tx_id ~ '^[A-Za-z0-9_-]{43}$'),
  attempted_at timestamptz not null default now(),
  verified_at timestamptz,
  last_error text check (last_error is null or length(last_error) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (queue_id, kind),
  constraint score_upload_package_size check (kind <> 'package' or bytes <= 65536),
  constraint score_upload_tx_shape check (
    state not in ('uploaded', 'verified') or arweave_tx_id is not null
  ),
  constraint score_upload_verified_shape check (
    (state = 'verified' and verified_at is not null)
    or (state <> 'verified' and verified_at is null)
  )
);

create table public.score_playback_snapshot_revisions (
  environment text not null check (environment in ('development', 'preview', 'production')),
  chain_id bigint not null check (chain_id > 0),
  contract text not null check (contract ~ '^0x[0-9a-f]{40}$'),
  token_id bigint not null check (token_id > 0),
  revision integer not null check (revision > 0),
  queue_id uuid references public.score_nft_queue(id) on delete restrict,
  schema_id text not null check (schema_id ~ '^ripples[.][a-z0-9._-]+$'),
  original_token_uri text not null check (original_token_uri ~ '^ar://[A-Za-z0-9_-]{43}$'),
  metadata jsonb not null check (jsonb_typeof(metadata) = 'object'),
  events jsonb not null check (jsonb_typeof(events) = 'array'),
  sounds jsonb not null check (jsonb_typeof(sounds) = 'object'),
  resource_attestations jsonb not null check (jsonb_typeof(resource_attestations) = 'object'),
  compatibility jsonb check (compatibility is null or jsonb_typeof(compatibility) = 'object'),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (environment, chain_id, contract, token_id, revision),
  unique (environment, chain_id, contract, token_id, content_sha256)
);

create table public.score_playback_snapshot_active (
  environment text not null,
  chain_id bigint not null,
  contract text not null,
  token_id bigint not null,
  revision integer not null,
  activated_at timestamptz not null default now(),
  primary key (environment, chain_id, contract, token_id),
  foreign key (environment, chain_id, contract, token_id, revision)
    references public.score_playback_snapshot_revisions(
      environment, chain_id, contract, token_id, revision
    ) on delete restrict
);

create index score_playback_snapshot_queue_idx
  on public.score_playback_snapshot_revisions(queue_id) where queue_id is not null;

create or replace function public.reject_immutable_row_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'IMMUTABLE_PERMANENT_RECORD: %.%', tg_table_schema, tg_table_name;
end;
$$;

create trigger permanent_sound_sets_immutable
  before update or delete on public.permanent_sound_sets
  for each row execute function public.reject_immutable_row_mutation();
create trigger permanent_decoders_immutable
  before update or delete on public.permanent_decoders
  for each row execute function public.reject_immutable_row_mutation();
create trigger score_snapshot_revisions_immutable
  before update or delete on public.score_playback_snapshot_revisions
  for each row execute function public.reject_immutable_row_mutation();

create or replace function public.protect_verified_track_base()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.base_verified_at is not null and
    (new.base_ar_tx_id, new.base_sha256, new.base_bytes, new.base_mime, new.base_verified_at)
      is distinct from
    (old.base_ar_tx_id, old.base_sha256, old.base_bytes, old.base_mime, old.base_verified_at) then
    raise exception 'IMMUTABLE_PERMANENT_RECORD: tracks.base identity';
  end if;
  return new;
end;
$$;

create trigger tracks_verified_base_immutable
  before update on public.tracks
  for each row execute function public.protect_verified_track_base();

create or replace function public.protect_score_queue_pins()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.sound_set_id is not null and
    (new.sound_set_id, new.sounds_map_ar_tx_id, new.sounds_map_sha256,
      new.sounds_map_bytes, new.sounds_map_mime, new.decoder_id, new.decoder_ar_tx_id,
      new.decoder_sha256, new.decoder_bytes, new.decoder_mime, new.base_ar_tx_id,
      new.base_sha256, new.base_bytes, new.base_mime) is distinct from
    (old.sound_set_id, old.sounds_map_ar_tx_id, old.sounds_map_sha256,
      old.sounds_map_bytes, old.sounds_map_mime, old.decoder_id, old.decoder_ar_tx_id,
      old.decoder_sha256, old.decoder_bytes, old.decoder_mime, old.base_ar_tx_id,
      old.base_sha256, old.base_bytes, old.base_mime) then
    raise exception 'IMMUTABLE_PERMANENT_RECORD: score_nft_queue pins';
  end if;
  return new;
end;
$$;

create trigger score_queue_pins_immutable
  before update on public.score_nft_queue
  for each row execute function public.protect_score_queue_pins();

create or replace function public.protect_score_upload_ledger()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_PERMANENT_RECORD: score upload ledger';
  end if;
  if (new.queue_id, new.kind, new.content_sha256, new.bytes, new.mime) is distinct from
    (old.queue_id, old.kind, old.content_sha256, old.bytes, old.mime) then
    raise exception 'IMMUTABLE_PERMANENT_RECORD: score upload identity';
  end if;
  if old.arweave_tx_id is not null and new.arweave_tx_id is distinct from old.arweave_tx_id then
    raise exception 'IMMUTABLE_PERMANENT_RECORD: score upload txid';
  end if;
  if old.state = 'verified' and new is distinct from old then
    raise exception 'IMMUTABLE_PERMANENT_RECORD: verified score upload';
  end if;
  if new.state is distinct from old.state and not (
    (old.state = 'uploading' and new.state in ('uploaded', 'upload_result_unknown'))
    or (old.state = 'uploaded' and new.state = 'verified')
    or (old.state = 'upload_result_unknown' and new.state in ('uploaded', 'verified'))
  ) then
    raise exception 'INVALID_SCORE_UPLOAD_TRANSITION: % -> %', old.state, new.state;
  end if;
  return new;
end;
$$;

create trigger score_upload_ledger_protected
  before update or delete on public.score_arweave_upload_ledger
  for each row execute function public.protect_score_upload_ledger();

create or replace function public.write_score_upload_state(
  p_queue_id uuid, p_lease_owner uuid, p_kind text, p_content_sha256 text,
  p_bytes bigint, p_mime text, p_state text, p_arweave_tx_id text,
  p_last_error text default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
  v_updated integer;
begin
  if p_kind = 'events' then
    update public.score_nft_queue set events_sha256 = p_content_sha256,
      events_bytes = p_bytes, events_mime = p_mime, events_upload_state = p_state,
      events_ar_tx_id = p_arweave_tx_id,
      events_verified_at = case when p_state = 'verified' then v_now else null end,
      updated_at = v_now where id = p_queue_id and locked_by = p_lease_owner
      and lease_expires_at > v_now;
  elsif p_kind = 'package' then
    update public.score_nft_queue set package_sha256 = p_content_sha256,
      package_bytes = p_bytes, package_mime = p_mime, package_upload_state = p_state,
      package_ar_tx_id = p_arweave_tx_id,
      package_verified_at = case when p_state = 'verified' then v_now else null end,
      updated_at = v_now where id = p_queue_id and locked_by = p_lease_owner
      and lease_expires_at > v_now;
  elsif p_kind = 'metadata' then
    update public.score_nft_queue set metadata_sha256 = p_content_sha256,
      metadata_bytes = p_bytes, metadata_mime = p_mime, metadata_upload_state = p_state,
      metadata_ar_tx_id = p_arweave_tx_id,
      metadata_verified_at = case when p_state = 'verified' then v_now else null end,
      updated_at = v_now where id = p_queue_id and locked_by = p_lease_owner
      and lease_expires_at > v_now;
  else
    raise exception 'INVALID_SCORE_UPLOAD_KIND: %', p_kind;
  end if;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return false; end if;

  insert into public.score_arweave_upload_ledger (
    queue_id, kind, content_sha256, bytes, mime, state, arweave_tx_id,
    verified_at, last_error, updated_at
  ) values (
    p_queue_id, p_kind, p_content_sha256, p_bytes, p_mime, p_state,
    p_arweave_tx_id, case when p_state = 'verified' then v_now else null end,
    p_last_error, v_now
  ) on conflict (queue_id, kind) do update set
    state = excluded.state, arweave_tx_id = excluded.arweave_tx_id,
    verified_at = excluded.verified_at, last_error = excluded.last_error,
    updated_at = excluded.updated_at;
  return true;
end;
$$;

create or replace function public.protect_snapshot_active_pointer()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.revision <> 1 then raise exception 'FIRST_SNAPSHOT_REVISION_MUST_BE_ONE'; end if;
    return new;
  end if;
  if (new.environment, new.chain_id, new.contract, new.token_id) is distinct from
    (old.environment, old.chain_id, old.contract, old.token_id) then
    raise exception 'SNAPSHOT_IDENTITY_IS_IMMUTABLE';
  end if;
  if new.revision <> old.revision + 1 then
    raise exception 'SNAPSHOT_REVISION_MUST_ADVANCE_BY_ONE';
  end if;
  new.activated_at := now();
  return new;
end;
$$;

create trigger score_snapshot_active_forward_only
  before insert or update on public.score_playback_snapshot_active
  for each row execute function public.protect_snapshot_active_pointer();
create trigger score_snapshot_active_no_delete
  before delete on public.score_playback_snapshot_active
  for each row execute function public.reject_immutable_row_mutation();

create or replace function public.publish_score_playback_snapshot(
  p_environment text,
  p_chain_id bigint,
  p_contract text,
  p_token_id bigint,
  p_queue_id uuid,
  p_schema_id text,
  p_original_token_uri text,
  p_metadata jsonb,
  p_events jsonb,
  p_sounds jsonb,
  p_resource_attestations jsonb,
  p_compatibility jsonb,
  p_content_sha256 text
) returns setof public.score_playback_snapshot_revisions
language plpgsql security definer set search_path = '' as $$
declare
  v_contract text := lower(p_contract);
  v_current_revision integer;
  v_next_revision integer;
  v_existing public.score_playback_snapshot_revisions%rowtype;
  v_inserted public.score_playback_snapshot_revisions%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    p_environment || ':' || p_chain_id::text || ':' || v_contract || ':' || p_token_id::text, 0
  ));
  select a.revision into v_current_revision
  from public.score_playback_snapshot_active a
  where a.environment = p_environment and a.chain_id = p_chain_id
    and a.contract = v_contract and a.token_id = p_token_id for update;

  select r.* into v_existing from public.score_playback_snapshot_revisions r
  where r.environment = p_environment and r.chain_id = p_chain_id
    and r.contract = v_contract and r.token_id = p_token_id
    and r.content_sha256 = p_content_sha256;
  if found then
    if (v_existing.queue_id, v_existing.schema_id, v_existing.original_token_uri,
      v_existing.metadata, v_existing.events, v_existing.sounds,
      v_existing.resource_attestations, v_existing.compatibility) is distinct from
      (p_queue_id, p_schema_id, p_original_token_uri, p_metadata, p_events, p_sounds,
      p_resource_attestations, p_compatibility) then
      raise exception 'SNAPSHOT_CONTENT_IDENTITY_CHANGED';
    end if;
    if v_current_revision is distinct from v_existing.revision then
      raise exception 'SNAPSHOT_REPLAY_IS_NOT_ACTIVE';
    end if;
    return next v_existing;
    return;
  end if;

  v_next_revision := coalesce(v_current_revision, 0) + 1;
  insert into public.score_playback_snapshot_revisions (
    environment, chain_id, contract, token_id, revision, queue_id, schema_id,
    original_token_uri, metadata, events, sounds, resource_attestations,
    compatibility, content_sha256, verified_at
  ) values (
    p_environment, p_chain_id, v_contract, p_token_id, v_next_revision, p_queue_id,
    p_schema_id, p_original_token_uri, p_metadata, p_events, p_sounds,
    p_resource_attestations, p_compatibility, p_content_sha256, now()
  ) returning * into v_inserted;

  insert into public.score_playback_snapshot_active (
    environment, chain_id, contract, token_id, revision
  ) values (p_environment, p_chain_id, v_contract, p_token_id, v_next_revision)
  on conflict (environment, chain_id, contract, token_id) do update
    set revision = excluded.revision, activated_at = now();

  return next v_inserted;
end;
$$;

create or replace function public.mint_score_enqueue(
  p_user_id uuid,
  p_pending_score_id uuid
) returns table (queue_id uuid, cover_ar_tx_id text)
language plpgsql security definer set search_path = '' as $$
declare
  v_rate_count integer;
  v_track_id uuid;
  v_track public.tracks%rowtype;
  v_draft_status text;
  v_draft_user_id uuid;
  v_already_enqueued boolean;
  v_cover_id uuid;
  v_cover_ar_tx_id text;
  v_queue_id uuid;
  v_sound_set public.permanent_sound_sets%rowtype;
  v_decoder public.permanent_decoders%rowtype;
  v_sound_set_id text;
  v_decoder_id text;
begin
  perform pg_advisory_xact_lock(hashtext('mint_score_enqueue'), hashtext(p_user_id::text));

  select count(*) into v_rate_count from public.score_nft_queue
  where user_id = p_user_id and created_at > now() - interval '1 hour';
  if v_rate_count >= 5 then
    raise exception 'RATE_LIMITED: max 5 score mints per hour (current=%)', v_rate_count;
  end if;

  select ps.status, ps.user_id, ps.track_id
    into v_draft_status, v_draft_user_id, v_track_id
  from public.pending_scores ps where ps.id = p_pending_score_id for share;
  if v_track_id is null then
    raise exception 'INVALID_SCORE: pending_score not found (id=%)', p_pending_score_id;
  end if;
  if v_draft_user_id != p_user_id then
    raise exception 'INVALID_SCORE: pending_score does not belong to user';
  end if;
  if v_draft_status != 'draft' then
    raise exception 'INVALID_SCORE: pending_score status=% (expected draft)', v_draft_status;
  end if;
  select t.* into v_track from public.tracks t where t.id = v_track_id for share;

  select exists (select 1 from public.score_nft_queue
    where pending_score_id = p_pending_score_id) into v_already_enqueued;
  if v_already_enqueued then
    raise exception 'INVALID_SCORE: pending_score already enqueued (id=%)', p_pending_score_id;
  end if;

  select a.sound_set_id, a.decoder_id into v_sound_set_id, v_decoder_id
  from public.permanent_core_active a where a.singleton for share;
  select s.* into v_sound_set from public.permanent_sound_sets s where s.id = v_sound_set_id;
  select d.* into v_decoder from public.permanent_decoders d where d.id = v_decoder_id;
  if v_sound_set.id is null or v_decoder.id is null or v_track.base_verified_at is null then
    raise exception 'PERMANENT_CORE_NOT_READY: active sound set, decoder, or base identity missing';
  end if;

  select id, ar_tx_id into v_cover_id, v_cover_ar_tx_id from public.score_covers
  order by usage_count asc, created_at asc limit 1 for update skip locked;
  if v_cover_id is null then
    raise exception 'COVER_POOL_EMPTY: no available cover (check score_covers table)';
  end if;
  update public.score_covers set usage_count = usage_count + 1 where id = v_cover_id;

  insert into public.score_nft_queue (
    user_id, pending_score_id, track_id, cover_ar_tx_id, status,
    sound_set_id, sounds_map_ar_tx_id, sounds_map_sha256, sounds_map_bytes,
    sounds_map_mime, decoder_id, decoder_ar_tx_id, decoder_sha256, decoder_bytes,
    decoder_mime, base_ar_tx_id, base_sha256, base_bytes, base_mime, requires_package_v3
  ) values (
    p_user_id, p_pending_score_id, v_track.id, v_cover_ar_tx_id, 'pending',
    v_sound_set.id, v_sound_set.sounds_map_ar_tx_id, v_sound_set.sounds_map_sha256,
    v_sound_set.sounds_map_bytes, v_sound_set.sounds_map_mime, v_decoder.id,
    v_decoder.ar_tx_id, v_decoder.sha256, v_decoder.bytes, v_decoder.mime,
    v_track.base_ar_tx_id, v_track.base_sha256, v_track.base_bytes, v_track.base_mime, true
  ) returning id into v_queue_id;

  return query select v_queue_id, v_cover_ar_tx_id;
end;
$$;

create or replace function public.claim_score_queue_job(
  p_owner uuid,
  p_lease_minutes integer default 5
) returns setof public.score_nft_queue
language plpgsql security definer set search_path = '' as $$
begin
  if p_owner is null or p_lease_minutes <> 5 then
    raise exception 'Score lease owner is required and lease must be 5 minutes';
  end if;
  return query
  update public.score_nft_queue q set
    locked_by = p_owner,
    lease_expires_at = now() + interval '5 minutes',
    updated_at = now()
  where q.id = (
    select c.id from public.score_nft_queue c
    where c.status in ('pending', 'uploading_events', 'preparing_package',
      'minting_onchain', 'uploading_metadata', 'setting_uri', 'finalizing_snapshot')
      and c.retry_count < 3
      and (c.lease_expires_at is null or c.lease_expires_at < now())
    order by c.created_at asc limit 1 for update skip locked
  ) returning q.*;
end;
$$;

alter table public.permanent_sound_sets enable row level security;
alter table public.permanent_decoders enable row level security;
alter table public.permanent_core_active enable row level security;
alter table public.score_arweave_upload_ledger enable row level security;
alter table public.score_playback_snapshot_revisions enable row level security;
alter table public.score_playback_snapshot_active enable row level security;

revoke all on table public.permanent_sound_sets, public.permanent_decoders,
  public.permanent_core_active, public.score_arweave_upload_ledger,
  public.score_playback_snapshot_revisions, public.score_playback_snapshot_active
  from public, anon, authenticated;
revoke all on function public.mint_score_enqueue(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_score_queue_job(uuid, integer) from public, anon, authenticated;
revoke all on function public.write_score_upload_state(
  uuid, uuid, text, text, bigint, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.publish_score_playback_snapshot(
  text, bigint, text, bigint, uuid, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function public.mint_score_enqueue(uuid, uuid) to service_role;
grant execute on function public.claim_score_queue_job(uuid, integer) to service_role;
grant execute on function public.write_score_upload_state(
  uuid, uuid, text, text, bigint, text, text, text, text
) to service_role;
grant execute on function public.publish_score_playback_snapshot(
  text, bigint, text, bigint, uuid, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, text
) to service_role;
