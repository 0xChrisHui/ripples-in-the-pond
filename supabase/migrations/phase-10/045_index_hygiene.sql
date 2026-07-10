-- P10-B P3-8 + P3-9: 索引卫生
-- review: reviews/2026-07-05-backend-review.md P3-8 / P3-9
--
-- P3-8：外键/高频查询列补覆盖索引（无索引的 FK 在删/查父行时全表扫）。
-- P3-9：users.evm_address 已有 unique 自动索引，idx_users_evm_address 冗余 → drop。
--
-- 幂等：create index if not exists / drop index if exists，可重复执行。

-- P3-8 FK 覆盖索引
create index if not exists idx_mint_queue_user on mint_queue (user_id);
create index if not exists idx_auth_identities_user on auth_identities (user_id);
create index if not exists idx_airdrop_recipients_user on airdrop_recipients (user_id);
create index if not exists idx_airdrop_recipients_status on airdrop_recipients (status);
create index if not exists idx_score_nft_queue_track on score_nft_queue (track_id);
create index if not exists idx_chain_events_from on chain_events (from_addr);
create index if not exists idx_chain_events_to on chain_events (to_addr);

-- P3-9 删冗余：unique(evm_address) 已建索引，此条重复
drop index if exists idx_users_evm_address;
