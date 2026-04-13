-- Phase 4 S1：privy_user_id 改为可空
-- Semi 用户没有 privy_user_id，但旧代码读它不会崩（只是 null）

alter table users alter column privy_user_id drop not null;
