-- P16-B：在 P15 Permanent Core 入队事务中加入 OP / ETH 共享 claim。

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
  v_cover_id uuid;
  v_cover_ar_tx_id text;
  v_queue_id uuid;
  v_claim public.score_mint_claims%rowtype;
  v_sound_set public.permanent_sound_sets%rowtype;
  v_decoder public.permanent_decoders%rowtype;
  v_sound_set_id text;
  v_decoder_id text;
begin
  perform pg_advisory_xact_lock(
    pg_catalog.hashtext('mint_score_enqueue'), pg_catalog.hashtext(p_user_id::text)
  );
  perform pg_advisory_xact_lock(
    pg_catalog.hashtext('score_mint_claim'), pg_catalog.hashtext(p_pending_score_id::text)
  );

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
  if v_draft_user_id <> p_user_id then
    raise exception 'INVALID_SCORE: pending_score does not belong to user';
  end if;
  if v_draft_status <> 'draft' then
    raise exception 'INVALID_SCORE: pending_score status=% (expected draft)', v_draft_status;
  end if;
  if exists (select 1 from public.score_nft_queue where pending_score_id = p_pending_score_id) then
    raise exception 'INVALID_SCORE: pending_score already enqueued (id=%)', p_pending_score_id;
  end if;
  select t.* into v_track from public.tracks t where t.id = v_track_id for share;

  select * into v_claim from public.score_mint_claims
  where pending_score_id = p_pending_score_id for update;
  if not found then
    insert into public.score_mint_claims (
      pending_score_id, user_id, mode, status
    ) values (p_pending_score_id, p_user_id, 'op_sponsored', 'active');
  elsif v_claim.status = 'released' and v_claim.user_id = p_user_id then
    update public.score_mint_claims set
      mode = 'op_sponsored', status = 'active', version = version + 1,
      op_queue_id = null, self_pay_order_id = null,
      released_at = null, release_reason = null, updated_at = now()
    where pending_score_id = p_pending_score_id;
  else
    raise exception 'MINT_CLAIM_CONFLICT: status=%, mode=%', v_claim.status, v_claim.mode;
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

  update public.score_mint_claims set op_queue_id = v_queue_id, updated_at = now()
  where pending_score_id = p_pending_score_id;
  return query select v_queue_id, v_cover_ar_tx_id;
end;
$$;

revoke all on function public.mint_score_enqueue(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mint_score_enqueue(uuid, uuid) to service_role;
