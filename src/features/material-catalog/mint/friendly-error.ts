export type MaterialNotice = { tone: 'info' | 'warn' | 'error'; title: string; hint?: string; detail?: string };

function chain(error: unknown) {
  const codes: unknown[] = [], texts: string[] = [];
  for (let current = error, depth = 0; current && typeof current === 'object' && depth < 6; depth++) {
    const value = current as { code?: unknown; message?: unknown; shortMessage?: unknown; cause?: unknown };
    codes.push(value.code); if (typeof value.shortMessage === 'string') texts.push(value.shortMessage);
    if (typeof value.message === 'string') texts.push(value.message); current = value.cause;
  }
  if (typeof error === 'string') texts.push(error);
  return { codes, text: texts.join('\n') };
}

/** 把钱包/网络/服务端异常转成面向收藏者的文案；原始信息只放进折叠的技术详情。 */
export function describeMaterialError(error: unknown, fallback = '铸造暂时没有完成'): MaterialNotice {
  const { codes, text } = chain(error);
  if (codes.some(code => code === 4001 || code === '4001') || /user (rejected|denied)/i.test(text)) {
    return { tone: 'info', title: '你在钱包中取消了这次铸造',
      hint: '没有发送交易，也不会产生费用。准备好后可以再次点击“铸造 Ethereum 原曲”。' };
  }
  if (/ETH不足|insufficient funds/i.test(text)) {
    return { tone: 'warn', title: '钱包 ETH 余额不足以支付 Gas',
      hint: '铸造本身不收费，只需支付网络 Gas。向接收地址充入少量 ETH 后，再点击铸造即可。' };
  }
  if (/failed to fetch|http request failed|network|timeout|timed out/i.test(text)) {
    return { tone: 'warn', title: '网络暂时不通', hint: '请检查网络后点“刷新状态”再试；订单已保留，不会重复发送。',
      detail: text.slice(0, 400) };
  }
  const plain = text.split('\n')[0]?.trim() ?? '';
  const readable = plain.length > 0 && plain.length <= 48 && /[\u4e00-\u9fa5]/.test(plain) && !/https?:|0x[0-9a-f]{8}/i.test(plain);
  return { tone: 'error', title: readable ? plain : fallback,
    hint: '请以下方订单状态为准；若显示“待核对”，请勿重复发送。', detail: readable ? undefined : text.slice(0, 400) || undefined };
}
