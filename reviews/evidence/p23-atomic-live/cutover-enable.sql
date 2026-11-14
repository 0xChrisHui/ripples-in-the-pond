begin;
set local lock_timeout='10s';
lock table public.score_nft_queue in share row exclusive mode;
do $$ begin
  if exists(select 1 from public.score_nft_queue where issuance_mode='legacy' and token_id is null
    and (status not in ('success','failed') or tx_hash is not null or mint_attempted_at is not null))
    then raise exception '尚有旧发行订单未对账'; end if;
  if (select column_default from information_schema.columns where table_schema='public'
    and table_name='score_nft_queue' and column_name='issuance_mode') <> '''atomic''::text'
    then raise exception '新订单默认模式不正确'; end if;
end $$;
update public.system_kv set value='true',updated_at=now() where key='score-atomic:enabled' and value='false';
commit;
select jsonb_build_object('default',(select column_default from information_schema.columns
  where table_schema='public' and table_name='score_nft_queue' and column_name='issuance_mode'),
  'flag',(select value from public.system_kv where key='score-atomic:enabled'),
  'changedAt',(select updated_at from public.system_kv where key='score-atomic:enabled')) as activation;
