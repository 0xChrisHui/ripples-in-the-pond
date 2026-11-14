begin;
set local lock_timeout='10s';
lock table public.score_nft_queue in share row exclusive mode;
alter table public.score_nft_queue alter column issuance_mode set default 'atomic';
insert into public.system_kv(key,value,updated_at) values ('score-atomic:enabled','false',now())
  on conflict(key) do update set value='false',updated_at=now();
commit;
select column_default from information_schema.columns where table_schema='public' and table_name='score_nft_queue' and column_name='issuance_mode';
