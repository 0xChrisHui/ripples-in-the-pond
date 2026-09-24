-- P16-B：Ethereum 自付订单的原子 prepare 与经链上清查后的 claim release。

create or replace function public.prepare_score_self_mint_order(
  p_user_id uuid,
  p_pending_score_id uuid,
  p_chain_id bigint,
  p_score_contract text,
  p_recipient_address text,
  p_order_id text
)
returns table (
  order_id text, token_id bigint, claim_version integer,
  cover_ar_tx_id text, status text
)
language plpgsql security definer set search_path = '' as $$
declare
  v_track_id uuid;
  v_track public.tracks%rowtype;
  v_score_status text;
  v_score_user_id uuid;
  v_claim public.score_mint_claims%rowtype;
  v_existing public.score_self_mint_orders%rowtype;
  v_cover_id uuid;
  v_cover_tx text;
  v_token_id bigint;
  v_sound_set public.permanent_sound_sets%rowtype;
  v_decoder public.permanent_decoders%rowtype;
  v_sound_set_id text;
  v_decoder_id text;
begin
  if p_chain_id not in (1, 11155111)
    or p_score_contract !~ '^0x[0-9A-Fa-f]{40}$'
    or p_recipient_address !~ '^0x[0-9A-Fa-f]{40}$'
    or p_order_id !~ '^0x[0-9a-f]{64}$' then
    raise exception 'INVALID_SELF_MINT_TARGET';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtext('score_mint_claim'), pg_catalog.hashtext(p_pending_score_id::text)
  );
  select p.track_id, p.status, p.user_id into v_track_id, v_score_status, v_score_user_id
  from public.pending_scores p where p.id = p_pending_score_id for update;
  if v_track_id is null or v_score_user_id <> p_user_id or v_score_status <> 'draft' then
    raise exception 'INVALID_SCORE: missing, foreign, or not draft';
  end if;
  select t.* into v_track from public.tracks t where t.id = v_track_id for share;

  select * into v_existing from public.score_self_mint_orders o
  where o.pending_score_id = p_pending_score_id
    and o.status in ('preparing_assets', 'ready_to_sign', 'submitted', 'confirming', 'manual_review')
  order by o.created_at desc limit 1 for update;
  if found then
    if v_existing.user_id <> p_user_id or v_existing.chain_id <> p_chain_id
      or v_existing.score_contract <> lower(p_score_contract)
      or v_existing.recipient_address <> lower(p_recipient_address) then
      raise exception 'SELF_MINT_ORDER_CONFLICT';
    end if;
    return query select v_existing.order_id, v_existing.token_id,
      v_existing.claim_version, v_existing.cover_ar_tx_id, v_existing.status;
    return;
  end if;

  if (select count(*) from public.score_self_mint_orders o
      where o.user_id = p_user_id and o.created_at >= now() - interval '1 hour') >= 5 then
    raise exception 'RATE_LIMITED';
  end if;

  select * into v_claim from public.score_mint_claims
  where pending_score_id = p_pending_score_id for update;
  if not found then
    insert into public.score_mint_claims (
      pending_score_id, user_id, mode, status
    ) values (p_pending_score_id, p_user_id, 'eth_self_paid', 'active')
    returning * into v_claim;
  elsif v_claim.status = 'released' and v_claim.user_id = p_user_id then
    update public.score_mint_claims set
      mode = 'eth_self_paid', status = 'active', version = version + 1,
      self_pay_order_id = null, released_at = null, release_reason = null, updated_at = now()
    where pending_score_id = p_pending_score_id returning * into v_claim;
  else
    raise exception 'MINT_CLAIM_CONFLICT: status=%, mode=%', v_claim.status, v_claim.mode;
  end if;

  select id, ar_tx_id into v_cover_id, v_cover_tx from public.score_covers
  order by usage_count asc, created_at asc limit 1 for update skip locked;
  if v_cover_id is null then raise exception 'COVER_POOL_EMPTY'; end if;
  update public.score_covers set usage_count = usage_count + 1 where id = v_cover_id;

  select a.sound_set_id, a.decoder_id into v_sound_set_id, v_decoder_id
  from public.permanent_core_active a where a.singleton for share;
  select s.* into v_sound_set from public.permanent_sound_sets s where s.id = v_sound_set_id;
  select d.* into v_decoder from public.permanent_decoders d where d.id = v_decoder_id;
  if v_sound_set.id is null or v_decoder.id is null or v_track.base_verified_at is null then
    raise exception 'PERMANENT_CORE_NOT_READY: active sound set, decoder, or base identity missing';
  end if;
  v_token_id := nextval('public.score_self_mint_token_id_seq');

  insert into public.score_self_mint_orders (
    order_id, claim_version, user_id, pending_score_id, track_id, chain_id,
    score_contract, token_id, recipient_address, cover_ar_tx_id,
    sound_set_id, sounds_map_ar_tx_id, sounds_map_sha256, sounds_map_bytes, sounds_map_mime,
    decoder_id, decoder_ar_tx_id, decoder_sha256, decoder_bytes, decoder_mime,
    base_ar_tx_id, base_sha256, base_bytes, base_mime
  ) values (
    p_order_id, v_claim.version, p_user_id, p_pending_score_id, v_track.id, p_chain_id,
    lower(p_score_contract), v_token_id, lower(p_recipient_address), v_cover_tx,
    v_sound_set.id, v_sound_set.sounds_map_ar_tx_id, v_sound_set.sounds_map_sha256,
    v_sound_set.sounds_map_bytes, v_sound_set.sounds_map_mime, v_decoder.id,
    v_decoder.ar_tx_id, v_decoder.sha256, v_decoder.bytes, v_decoder.mime,
    v_track.base_ar_tx_id, v_track.base_sha256, v_track.base_bytes, v_track.base_mime
  ) returning * into v_existing;

  update public.score_mint_claims set self_pay_order_id = p_order_id, updated_at = now()
  where pending_score_id = p_pending_score_id and version = v_claim.version;
  return query select v_existing.order_id, v_existing.token_id,
    v_existing.claim_version, v_existing.cover_ar_tx_id, v_existing.status;
end;
$$;

create or replace function public.release_score_self_mint_claim(
  p_user_id uuid,
  p_order_id text,
  p_reason text
)
returns public.score_mint_claims
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.score_self_mint_orders%rowtype;
  v_claim public.score_mint_claims%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) = 0 or length(p_reason) > 500 then
    raise exception 'INVALID_RELEASE_REASON';
  end if;
  select * into v_order from public.score_self_mint_orders
  where order_id = p_order_id and user_id = p_user_id for update;
  if not found or v_order.status not in ('expired', 'failed')
    or v_order.send_attempted_at is not null or v_order.tx_hash is not null
    or v_order.release_verified_at is null then
    raise exception 'UNSAFE_CLAIM_RELEASE';
  end if;

  update public.score_mint_claims set
    status = 'released', released_at = now(), release_reason = trim(p_reason), updated_at = now()
  where pending_score_id = v_order.pending_score_id
    and user_id = p_user_id and mode = 'eth_self_paid' and status = 'active'
    and version = v_order.claim_version
  returning * into v_claim;
  if not found then raise exception 'CLAIM_RELEASE_CONFLICT'; end if;
  return v_claim;
end;
$$;

revoke all on function public.prepare_score_self_mint_order(
  uuid, uuid, bigint, text, text, text
) from public, anon, authenticated;
revoke all on function public.release_score_self_mint_claim(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_score_self_mint_order(
  uuid, uuid, bigint, text, text, text
) to service_role;
grant execute on function public.release_score_self_mint_claim(uuid, text, text)
  to service_role;
