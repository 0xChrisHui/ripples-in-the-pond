-- P14-G1：链事件按 chain + contract 隔离，source cursor 只能经单调 RPC 写入。

alter table public.chain_events add column if not exists chain_id bigint;

update public.chain_events set
  contract = lower(contract),
  tx_hash = lower(tx_hash),
  from_addr = lower(from_addr),
  to_addr = lower(to_addr),
  chain_id = case lower(contract)
    when '0xac3f7471a4e1f5952b4c8f56521af46d6c20a4aa' then 10
    when '0x1c478f9f5b66302a35a0178e07df67ba343c832f' then 11155420
    when '0xa65c9308635c8dd068a314c189e8d77941a7e99c' then 11155420
    when '0xe0faed842283f3d689aa8619cbb0ccc232a1db23' then 11155420
    else chain_id
  end;

do $$
begin
  if exists (select 1 from public.chain_events where chain_id is null) then
    raise exception 'chain_events contains contracts without an audited chain mapping';
  end if;
end;
$$;

alter table public.chain_events alter column chain_id set not null;
alter table public.chain_events drop constraint if exists chain_events_chain_id_check;
alter table public.chain_events add constraint chain_events_chain_id_check
  check (chain_id in (10, 11155420));
alter table public.chain_events drop constraint if exists chain_events_contract_lowercase_check;
alter table public.chain_events add constraint chain_events_contract_lowercase_check
  check (contract ~ '^0x[0-9a-f]{40}$');

alter table public.chain_events drop constraint if exists chain_events_tx_hash_log_index_key;
alter table public.chain_events drop constraint if exists chain_events_source_log_unique;
alter table public.chain_events add constraint chain_events_source_log_unique
  unique (chain_id, contract, tx_hash, log_index);
create index if not exists idx_chain_events_source_block
  on public.chain_events (chain_id, contract, block_number, log_index);

create or replace function public.guard_source_chain_cursor_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.key like 'chain-events:cursor:%' then
    raise exception 'source chain cursor deletion is forbidden';
  end if;
  if tg_op <> 'DELETE' and new.key like 'chain-events:cursor:%'
    and current_setting('app.source_cursor_rpc', true) is distinct from 'allowed' then
    raise exception 'source chain cursor writes must use its RPC';
  end if;
  if tg_op = 'UPDATE' and old.key like 'chain-events:cursor:%'
    and new.key is distinct from old.key then
    raise exception 'source chain cursor identity is immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists guard_source_chain_cursor_write on public.system_kv;
create trigger guard_source_chain_cursor_write before insert or update or delete on public.system_kv
  for each row execute function public.guard_source_chain_cursor_write();

create or replace function public.initialize_source_chain_cursor(
  p_chain_id bigint, p_score_contract text, p_safe_head bigint
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_key text;
begin
  if p_chain_id not in (10, 11155420) or p_safe_head is null or p_safe_head < 0
    or p_score_contract is null or p_score_contract !~ '^0x[0-9a-f]{40}$' then
    raise exception 'invalid source cursor identity or safe head';
  end if;
  v_key := 'chain-events:cursor:' || p_chain_id || ':' || p_score_contract;
  perform set_config('app.source_cursor_rpc', 'allowed', true);
  insert into public.system_kv (key, value, updated_at)
    values (v_key, p_safe_head::text, now());
  return p_safe_head;
end;
$$;

create or replace function public.advance_source_chain_cursor(
  p_chain_id bigint, p_score_contract text, p_expected bigint, p_next bigint
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_key text;
  v_value text;
  v_current bigint;
begin
  if p_chain_id not in (10, 11155420) or p_expected is null or p_expected < 0
    or p_next is null or p_next < 0 or p_score_contract is null
    or p_score_contract !~ '^0x[0-9a-f]{40}$' then
    raise exception 'invalid source cursor advance';
  end if;
  v_key := 'chain-events:cursor:' || p_chain_id || ':' || p_score_contract;
  select k.value into v_value from public.system_kv k where k.key = v_key for update;
  if not found or v_value !~ '^[0-9]+$' then
    raise exception 'source cursor missing or malformed';
  end if;
  v_current := v_value::bigint;
  if v_current <> p_expected then
    raise exception 'source cursor expected-value conflict';
  end if;
  if p_next < v_current then
    raise exception 'source cursor regression rejected';
  end if;
  if p_next = v_current then return v_current; end if;
  perform set_config('app.source_cursor_rpc', 'allowed', true);
  update public.system_kv set value = p_next::text, updated_at = now() where key = v_key;
  return p_next;
end;
$$;

revoke all on function public.guard_source_chain_cursor_write() from public, anon, authenticated;
revoke all on function public.initialize_source_chain_cursor(bigint, text, bigint)
  from public, anon, authenticated;
revoke all on function public.advance_source_chain_cursor(bigint, text, bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.initialize_source_chain_cursor(bigint, text, bigint) to service_role;
grant execute on function public.advance_source_chain_cursor(bigint, text, bigint, bigint) to service_role;

notify pgrst, 'reload schema';
