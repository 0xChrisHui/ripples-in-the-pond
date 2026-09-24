-- P16-B：OP / ETH 共享铸造占用与 Ethereum 自付 v3 永久订单地基。

create sequence public.score_self_mint_token_id_seq start 1 minvalue 1;

create table public.score_mint_claims (
  pending_score_id uuid primary key references public.pending_scores(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  mode text not null check (mode in ('op_sponsored', 'eth_self_paid')),
  status text not null check (status in ('active', 'consumed', 'released', 'manual_review')),
  version integer not null default 1 check (version > 0),
  op_queue_id uuid references public.score_nft_queue(id) on delete restrict,
  self_pay_order_id text,
  released_at timestamptz,
  release_reason text check (release_reason is null or length(release_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint score_mint_claim_target check (
    (mode = 'op_sponsored' and self_pay_order_id is null)
    or (mode = 'eth_self_paid' and op_queue_id is null)
  ),
  constraint score_mint_claim_release check (
    (status = 'released' and released_at is not null and release_reason is not null)
    or (status <> 'released' and released_at is null and release_reason is null)
  )
);

create table public.score_self_mint_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique check (order_id ~ '^0x[0-9a-f]{64}$'),
  claim_version integer not null check (claim_version > 0),
  user_id uuid not null references public.users(id) on delete restrict,
  pending_score_id uuid not null references public.pending_scores(id) on delete restrict,
  track_id uuid not null references public.tracks(id) on delete restrict,
  chain_id bigint not null check (chain_id in (1, 11155111)),
  score_contract text not null check (score_contract ~ '^0x[0-9a-f]{40}$'),
  token_id bigint not null default nextval('public.score_self_mint_token_id_seq') check (token_id > 0),
  recipient_address text not null check (recipient_address ~ '^0x[0-9a-f]{40}$'),
  cover_ar_tx_id text not null check (cover_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'),
  sound_set_id text not null,
  sounds_map_ar_tx_id text not null,
  sounds_map_sha256 text not null,
  sounds_map_bytes bigint not null,
  sounds_map_mime text not null,
  decoder_id text not null,
  decoder_ar_tx_id text not null,
  decoder_sha256 text not null,
  decoder_bytes bigint not null,
  decoder_mime text not null,
  base_ar_tx_id text not null,
  base_sha256 text not null,
  base_bytes bigint not null,
  base_mime text not null,
  requires_package_v3 boolean not null default true check (requires_package_v3),
  events_ar_tx_id text check (events_ar_tx_id is null or events_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'),
  events_sha256 text,
  events_bytes bigint,
  events_mime text,
  events_upload_state text not null default 'none',
  events_verified_at timestamptz,
  package_ar_tx_id text check (package_ar_tx_id is null or package_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'),
  package_sha256 text,
  package_bytes bigint,
  package_mime text,
  package_upload_state text not null default 'none',
  package_verified_at timestamptz,
  metadata_ar_tx_id text check (metadata_ar_tx_id is null or metadata_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$'),
  metadata_sha256 text,
  metadata_bytes bigint,
  metadata_mime text,
  metadata_upload_state text not null default 'none',
  metadata_verified_at timestamptz,
  token_uri text check (token_uri is null or token_uri ~ '^ar://[A-Za-z0-9_-]{43}$'),
  typed_data_digest text check (typed_data_digest is null or typed_data_digest ~ '^0x[0-9a-f]{64}$'),
  uri_hash text check (uri_hash is null or uri_hash ~ '^0x[0-9a-f]{64}$'),
  voucher_deadline bigint check (voucher_deadline is null or voucher_deadline > 0),
  authorizer_address text check (authorizer_address is null or authorizer_address ~ '^0x[0-9a-f]{40}$'),
  authorization_issued_at timestamptz,
  signature_version smallint not null default 1 check (signature_version > 0),
  send_attempted_at timestamptz,
  tx_hash text check (tx_hash is null or tx_hash ~ '^0x[0-9a-f]{64}$'),
  failed_tx_hash text check (failed_tx_hash is null or failed_tx_hash ~ '^0x[0-9a-f]{64}$'),
  replacement_tx_hash text check (replacement_tx_hash is null or replacement_tx_hash ~ '^0x[0-9a-f]{64}$'),
  block_number bigint check (block_number is null or block_number >= 0),
  confirmed_at timestamptz,
  release_verified_at timestamptz,
  status text not null default 'preparing_assets' check (status in (
    'preparing_assets', 'ready_to_sign', 'submitted', 'confirming',
    'success', 'expired', 'failed', 'manual_review'
  )),
  failure_stage text,
  failure_code text,
  retryable boolean not null default false,
  retry_count integer not null default 0 check (retry_count >= 0),
  last_error text check (last_error is null or length(last_error) <= 2000),
  locked_by uuid,
  lease_expires_at timestamptz,
  last_reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain_id, score_contract, order_id),
  unique (chain_id, score_contract, token_id),
  constraint score_self_mint_tx_distinct check (replacement_tx_hash is null or replacement_tx_hash <> tx_hash),
  constraint score_self_mint_lease_shape check (
    (locked_by is null and lease_expires_at is null) or (locked_by is not null and lease_expires_at is not null)
  ),
  constraint score_self_mint_pin_shape check (
    sounds_map_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$' and sounds_map_sha256 ~ '^[0-9a-f]{64}$'
    and sounds_map_bytes > 0 and sounds_map_mime = 'application/json'
    and decoder_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$' and decoder_sha256 ~ '^[0-9a-f]{64}$'
    and decoder_bytes > 0 and decoder_mime = 'text/html'
    and base_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$' and base_sha256 ~ '^[0-9a-f]{64}$'
    and base_bytes > 0 and base_mime = 'audio/mpeg'
  ),
  constraint score_self_mint_events_shape check (
    (events_upload_state = 'none' and events_ar_tx_id is null and events_sha256 is null
      and events_bytes is null and events_mime is null and events_verified_at is null)
    or (events_upload_state in ('uploading', 'uploaded', 'verified', 'upload_result_unknown')
      and events_sha256 ~ '^[0-9a-f]{64}$' and events_bytes > 0 and events_mime = 'application/json'
      and (events_upload_state not in ('uploaded', 'verified') or events_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$')
      and ((events_upload_state = 'verified' and events_verified_at is not null)
        or (events_upload_state <> 'verified' and events_verified_at is null)))
  ),
  constraint score_self_mint_package_shape check (
    (package_upload_state = 'none' and package_ar_tx_id is null and package_sha256 is null
      and package_bytes is null and package_mime is null and package_verified_at is null)
    or (package_upload_state in ('uploading', 'uploaded', 'verified', 'upload_result_unknown')
      and package_sha256 ~ '^[0-9a-f]{64}$' and package_bytes between 1 and 65536
      and package_mime = 'application/json'
      and (package_upload_state not in ('uploaded', 'verified') or package_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$')
      and ((package_upload_state = 'verified' and package_verified_at is not null)
        or (package_upload_state <> 'verified' and package_verified_at is null)))
  ),
  constraint score_self_mint_metadata_shape check (
    (metadata_upload_state = 'none' and metadata_ar_tx_id is null and metadata_sha256 is null
      and metadata_bytes is null and metadata_mime is null and metadata_verified_at is null)
    or (metadata_upload_state in ('uploading', 'uploaded', 'verified', 'upload_result_unknown')
      and metadata_sha256 ~ '^[0-9a-f]{64}$' and metadata_bytes > 0 and metadata_mime = 'application/json'
      and (metadata_upload_state not in ('uploaded', 'verified') or metadata_ar_tx_id ~ '^[A-Za-z0-9_-]{43}$')
      and ((metadata_upload_state = 'verified' and metadata_verified_at is not null)
        or (metadata_upload_state <> 'verified' and metadata_verified_at is null)))
  ),
  constraint score_self_mint_ready_shape check (
    status not in ('ready_to_sign', 'submitted', 'confirming', 'success')
    or (events_upload_state = 'verified' and package_upload_state = 'verified'
      and metadata_upload_state = 'verified' and token_uri = 'ar://' || metadata_ar_tx_id)
  ),
  constraint score_self_mint_success_shape check (
    status <> 'success' or (tx_hash is not null and block_number is not null and confirmed_at is not null)
  ),
  constraint score_self_mint_sound_set_fk foreign key (
    sound_set_id, sounds_map_ar_tx_id, sounds_map_sha256, sounds_map_bytes, sounds_map_mime
  ) references public.permanent_sound_sets (
    id, sounds_map_ar_tx_id, sounds_map_sha256, sounds_map_bytes, sounds_map_mime
  ) on delete restrict,
  constraint score_self_mint_decoder_fk foreign key (
    decoder_id, decoder_ar_tx_id, decoder_sha256, decoder_bytes, decoder_mime
  ) references public.permanent_decoders (id, ar_tx_id, sha256, bytes, mime) on delete restrict,
  constraint score_self_mint_base_fk foreign key (
    track_id, base_ar_tx_id, base_sha256, base_bytes, base_mime
  ) references public.tracks (id, base_ar_tx_id, base_sha256, base_bytes, base_mime) on delete restrict
);

alter table public.score_mint_claims add constraint score_mint_claim_order_fk
  foreign key (self_pay_order_id) references public.score_self_mint_orders(order_id) on delete restrict;
create unique index score_self_mint_tx_unique on public.score_self_mint_orders(chain_id, tx_hash)
  where tx_hash is not null;
create unique index score_self_mint_active_pending_unique
  on public.score_self_mint_orders(pending_score_id, chain_id)
  where status in ('preparing_assets', 'ready_to_sign', 'submitted', 'confirming', 'manual_review');
create index score_self_mint_reconcile_idx on public.score_self_mint_orders(status, last_reconciled_at, created_at)
  where status in ('submitted', 'confirming') or (status = 'manual_review' and send_attempted_at is not null);
create index score_self_mint_user_idx on public.score_self_mint_orders(user_id, created_at desc);

insert into public.score_mint_claims (pending_score_id, user_id, mode, status, op_queue_id)
select q.pending_score_id, q.user_id, 'op_sponsored', case
  when q.status = 'success' then 'consumed'
  when q.failure_kind = 'manual_review' then 'manual_review' else 'active' end, q.id
from public.score_nft_queue q on conflict (pending_score_id) do nothing;

create function public.sync_op_score_mint_claim() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'success' then
    update public.score_mint_claims set status = 'consumed', updated_at = now()
    where pending_score_id = new.pending_score_id and mode = 'op_sponsored';
  elsif new.failure_kind = 'manual_review' then
    update public.score_mint_claims set status = 'manual_review', updated_at = now()
    where pending_score_id = new.pending_score_id and mode = 'op_sponsored';
  end if;
  return new;
end;
$$;
create trigger sync_op_score_mint_claim after update of status, failure_kind on public.score_nft_queue
for each row execute function public.sync_op_score_mint_claim();

alter table public.score_mint_claims enable row level security;
alter table public.score_self_mint_orders enable row level security;
revoke all on public.score_mint_claims, public.score_self_mint_orders from public, anon, authenticated;
grant select, insert, update on public.score_mint_claims, public.score_self_mint_orders to service_role;
grant usage, select on sequence public.score_self_mint_token_id_seq to service_role;
