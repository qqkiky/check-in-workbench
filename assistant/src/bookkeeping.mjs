import { cstDay, validDate } from './domain.mjs';

export const RETENTION_MS = 7 * 86400000;
export function expireBookkeeping(state, now = Date.now()) {
  state.bookkeeping = (state.bookkeeping || []).filter(item => now - item.createdAt < RETENTION_MS);
  state.outbox = (state.outbox || []).filter(item => !item.key.startsWith('finance-') || now - item.createdAt < RETENTION_MS);
  if (state.bookkeepingDraft && now - state.bookkeepingDraft.createdAt >= RETENTION_MS) delete state.bookkeepingDraft;
}
export function bookkeepingInput(text, draft) {
  if (!draft && !/记账|记一笔|收入|支出|花了|付了|支付|元|块钱/.test(text)
    && (/提醒我|记得|待办|日程|安排/.test(text) || /(今天|明天|后天|下周|周[一二三四五六日天])/.test(text) && /点|[:：]\d{2}|上午|下午|晚上|中午/.test(text))) return null;
  text = text.replace(/(?<![\d.])[零〇一二两三四五六七八九十百千万]+(?:点[零〇一二两三四五六七八九]+)?(?=元|块)/g, value => {
    const digits = '零一二三四五六七八九';
    const [whole, fraction] = value.replace(/〇/g,'零').replace(/两/g,'二').split('点');
    let total = 0, section = 0, number = 0;
    for (const ch of whole) {
      if (digits.includes(ch)) number = digits.indexOf(ch);
      else if (ch === '万') { total += (section + number) * 10000; section = number = 0; }
      else { section += (number || 1) * ({十:10,百:100,千:1000}[ch]); number = 0; }
    }
    return String(total + section + number) + (fraction ? '.' + [...fraction].map(ch=>digits.indexOf(ch)).join('') : '');
  });
  if (/查账|账单|余额|花了多少|支出多少|收入多少/.test(text)) return { query: true };
  if (draft && /^(取消|不记了|取消记账)[。！!]*$/.test(text)) return { cancel: true };
  const explicit = text.match(/^(?:账户|账号)(?:是|用|为|[:：])\s*(.{1,60})$/);
  const specifiedDate = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (specifiedDate) text = text.replace(specifiedDate,'');
  const accounts = [...text.matchAll(/微信|支付宝|现金|银行卡/g)].map(m => m[0]);
  const amounts = [...text.matchAll(/(?:¥|￥)?(\d+(?:\.\d{1,2})?)(?:\s*(?:元|块(?:钱)?))?/g)];
  const financial = /记账|记一笔|收入|支出|花了|付了|支付|买了|午饭|晚饭|早饭|工资|奖金|元|块钱/.test(text) || accounts.length > 0 && amounts.length > 0;
  if (!draft && !financial) return null;
  if (draft && !financial && !explicit && !/^(微信|支付宝|现金|银行卡|\d+(?:\.\d{1,2})?)[。！!]*$/.test(text)) return null;
  if (/转账|借款|还款|退款/.test(text)) return { question: '转账、借还款和退款请在 APK 中操作，避免误算成收入或支出。' };
  // Ambiguous numbers, dates and currencies need explicit clarification, never guess an amount.
  if (amounts.length > 1 || /美元|美金|港币|港元|欧元|日元|USD|HKD|EUR|JPY|人民币以外/i.test(text)) return { question: '请一次发送一笔人民币账目，例如“微信，午饭支出30元”。' };
  if (/[-负]\s*(?:[¥￥]\s*)?\d|\d\s*[万千百]|明天|后天|上周|上月|\d+号|\d+日/.test(text)) return { question: '请明确正数金额及记账日期；支持今天、昨天、前天或 YYYY-MM-DD 日期。' };
  if (specifiedDate && !validDate(specifiedDate)) return { question: '记账日期无效，请重新发送 YYYY-MM-DD 日期。' };
  if (/收入/.test(text) && /支出/.test(text)) return { question: '这笔是收入还是支出？请一次发送一笔账。' };
  const cents = amounts.length ? Math.round(Number(amounts[0][1]) * 100) : undefined;
  if (cents !== undefined && (!Number.isSafeInteger(cents) || cents <= 0 || cents > 1e12 || /\d+\.\d{3}/.test(text))) return { question: '请提供大于零、最多两位小数的人民币金额。' };
  if (new Set(accounts).size > 1) return { question: '这笔账使用哪个账户？请回复“账户：APK 中的完整账户名”。' };
  const day = specifiedDate || (/昨天/.test(text) ? cstDay(Date.now() - 86400000) : /前天/.test(text) ? cstDay(Date.now() - 2 * 86400000) : undefined);
  const note = financial ? text.replace(/(?:¥|￥)?\d+(?:\.\d+)?\s*(?:元|块钱|块)?/g, '').replace(/微信|支付宝|现金|银行卡|记账|记一笔|支出|收入|花了|付了|支付|昨天|今天|前天|[，,。；;]/g, '').trim() : undefined;
  return { amountCents: cents, accountName: explicit?.[1]?.trim() || accounts[0], date: day,
    type: /收入/.test(text) ? 'income' : /支出/.test(text) ? 'expense' : /工资|奖金|到账/.test(text) ? 'income' : /花了|付了|支付|买了|午饭|晚饭|早饭/.test(text) ? 'expense' : undefined,
    note: note || undefined };
}
export function applyBookkeeping(state, input, sourceId, now = Date.now()) {
  expireBookkeeping(state, now);
  if (input.query) return '完整账本只在手机中保存，请在 APK 的记账页查账。';
  if (input.question) return input.question;
  if (input.cancel) {
    state.bookkeeping = state.bookkeeping.filter(item=>item.id !== state.bookkeepingDraft?.id);
    delete state.bookkeepingDraft;
    return '已取消这笔待补齐的记录；已在手机入账的账目请在 APK 修改。';
  }
  if (state.bookkeepingDraft?.note && input.note && input.note !== state.bookkeepingDraft.note) return '还有一笔账未补齐，请先补充上一笔信息；若不再记录上一笔，请回复“取消记账”后重发。';
  const draft = { ...(state.bookkeepingDraft || { id: `wxbook-${sourceId.replace(/[^\w-]/g, '').slice(0,60)}`, createdAt: now, date: cstDay(now) }) };
  for (const key of ['amountCents','accountName','type','note','date']) if (input[key] !== undefined) draft[key] = input[key];
  state.bookkeepingDraft = draft;
  if (!draft.amountCents) return '这笔账是多少元？请回复“支出30元”或“收入100元”。';
  if (!draft.type) return '这笔是收入还是支出？请回复“收入”或“支出”。';
  if (!draft.accountName) return '这笔账用哪个账户？请回复“账户：APK 中的完整账户名”。';
  if (!validDate(draft.date)) return '日期不明确，请重新发送这笔账。';
  const previous = state.bookkeeping.find(item => item.id === draft.id);
  if (previous) Object.assign(previous, draft, { version: previous.version + 1 });
  else {
    if (state.bookkeeping.length >= 100) return '待同步账目已满，请先打开 APK 同步。';
    state.bookkeeping.push({ ...draft, note: (draft.note || '微信记账').slice(0,200), version: 1 });
  }
  delete state.bookkeepingDraft;
  return `收到：${draft.accountName}，${draft.type === 'income' ? '收入' : '支出'}${(draft.amountCents / 100).toFixed(2)}元。待手机同步，尚未入账；请打开 APK 自动接收。`;
}
export function receiveBookkeeping(state, receipts) {
  const replies = [];
  for (const receipt of receipts) {
    const item = (state.bookkeeping || []).find(item => item.id === receipt.id && item.version === receipt.version);
    if (!item) continue;
    if (receipt.status === 'applied') {
      state.bookkeeping = state.bookkeeping.filter(entry => entry.id !== item.id);
      if (state.bookkeepingDraft?.id === item.id) delete state.bookkeepingDraft;
      replies.push('手机已确认入账。完整账目保存在 APK 中，助手云端已移除这笔待同步记录。');
    } else if (receipt.status === 'account_required' && item.warnedVersion !== item.version && !state.bookkeepingDraft) {
      item.warnedVersion = item.version;
      state.bookkeepingDraft = { ...item };
      delete state.bookkeepingDraft.accountName;
      replies.push('手机没有找到唯一匹配的账户，尚未入账。请回复“账户：APK 中的完整账户名”。');
    }
  }
  return replies;
}
