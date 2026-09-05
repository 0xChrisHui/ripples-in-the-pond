export type ArtistContent = {
  displayName: string;
  identityLine: string;
  biography: string;
  statement: string;
  project108: string;
  publicLinks: Array<{ label: string; href: string }>;
  contentStatus: string;
};

/**
 * 用户已授权先以草稿进入页面；这里不写履历、奖项、年份或身份事实。
 * 正式内容到齐后只替换这个模块，不改页面结构与真实统计。
 */
export const artistContent: ArtistContent = {
  displayName: '艺术家（署名待确认）',
  identityLine: '围绕声音相遇、共同演奏与永久保存展开长期实践',
  biography:
    '这份文字肖像尚未加入未经确认的履历、年份或身份事实。现阶段只记录项目已经能够证明的工作：音乐进入水塘，听者可以在其中共同演奏，并把一次声音相遇保存为可核验、可重放的作品。',
  statement:
    '我希望一段音乐不只停在单向播放里。它可以先成为一个邀请：有人靠近、听见、按下声音，也留下自己的节奏。一次演奏结束以后，那段共同发生的时间仍然能够被保存和再次听见。水波会散开，声音也会消失，但作品留下的不是对现场的替代，而是一份可以回到原始材料、演奏事件与永久凭证的记录，同时对下一次相遇保持开放。这段文字是语气草稿，等待艺术家本人确认或改写。',
  project108:
    '108 首是 Ripples in the Pond 已确认的长期作品总量。页面暂不把它拆成任何未经确认的阶段，也不把完成度包装成销售倒计时。每次参与从一次演奏开始，保存后形成永久资源，再由 ScoreNFT 记录并提供可重放的公开唱片。为什么选择 108、作品之间如何连接，将在艺术家确认正式说明后替换这段草稿。',
  publicLinks: [],
  contentStatus: '文字草稿 · 待艺术家确认',
};
