// 出遊分帳：多筆支出、每筆由不同人付、由不同人分，最後一起結算

import { settle } from "./split";

export type Member = {
  id: string;
  name: string;
  paid: boolean; // 已把該付的錢轉出去
  payInfo?: string; // 收款方式，例如 LINE Pay、銀行帳號
};

export type Expense = {
  id: string;
  name: string;
  amount: number;
  payerId: string | null;
  sharedBy: string[]; // 空陣列 = 所有人一起分
  currency?: string; // 沒填 = 結算幣別
  twd?: number | null; // 刷卡實付（以結算幣別計）；有填就以這個為準，不用匯率換算
};

// 外幣匯率：1 單位外幣 = rate 單位結算幣別
export type Currency = { code: string; rate: number };

export type TripState = {
  id: string;
  title: string;
  base?: string; // 結算幣別，預設台幣
  currencies: Currency[];
  members: Member[];
  expenses: Expense[];
};

export const BASE_CURRENCY = "TWD";

export const baseOf = (s: TripState) => s.base || BASE_CURRENCY;

// 常用幣別：中文名稱、符號、換算範例金額、抓不到即時匯率時的參考匯率（1 單位 = ? 台幣）
// Windows 不顯示國旗表情符號，所以用貨幣符號
export const CURRENCY_INFO: { code: string; name: string; symbol: string; sample: number; fallback: number }[] = [
  { code: "TWD", name: "台幣", symbol: "NT$", sample: 1000, fallback: 1 },
  { code: "JPY", name: "日圓", symbol: "¥", sample: 10000, fallback: 0.205 },
  { code: "KRW", name: "韓元", symbol: "₩", sample: 100000, fallback: 0.0241 },
  { code: "USD", name: "美元", symbol: "US$", sample: 100, fallback: 32.4 },
  { code: "EUR", name: "歐元", symbol: "€", sample: 100, fallback: 36.3 },
  { code: "THB", name: "泰銖", symbol: "฿", sample: 1000, fallback: 0.966 },
  { code: "HKD", name: "港幣", symbol: "HK$", sample: 1000, fallback: 4.13 },
  { code: "CNY", name: "人民幣", symbol: "RMB", sample: 1000, fallback: 4.82 },
  { code: "SGD", name: "新幣", symbol: "S$", sample: 100, fallback: 25.2 },
  { code: "GBP", name: "英鎊", symbol: "£", sample: 100, fallback: 42.9 },
  { code: "AUD", name: "澳幣", symbol: "A$", sample: 100, fallback: 22.4 },
  { code: "VND", name: "越南盾", symbol: "₫", sample: 1000000, fallback: 0.00125 },
  { code: "MYR", name: "馬幣", symbol: "RM", sample: 100, fallback: 7.92 },
];

export const currencyInfo = (code: string) =>
  CURRENCY_INFO.find((c) => c.code === code) ?? { code, name: code, symbol: code, sample: 100, fallback: 1 };

/** 即時匯率：values[code] = 1 單位該幣別可換多少台幣 */
export type LiveRates = { updated: string; values: Record<string, number> };

export async function fetchLiveRates(): Promise<LiveRates> {
  const res = await fetch("https://open.er-api.com/v6/latest/TWD");
  const data = await res.json();
  if (data.result !== "success") throw new Error("rate api failed");
  const values: Record<string, number> = { TWD: 1 };
  for (const { code } of CURRENCY_INFO) {
    const perTwd = data.rates?.[code];
    if (perTwd > 0) values[code] = 1 / perTwd;
  }
  return { updated: new Date().toISOString(), values };
}

/** 市場匯率：1 單位 code = ? 單位 base（有即時匯率用即時，沒有用參考值） */
export function marketRate(code: string, base: string, live: LiveRates) {
  const twd = (c: string) => live.values[c] ?? currencyInfo(c).fallback;
  return twd(code) / twd(base);
}

/** 換算成結算幣別；有填刷卡實付金額就直接用 */
export function toBase(e: Expense, s: TripState) {
  if (!e.currency || e.currency === baseOf(s)) return e.amount;
  if (e.twd && e.twd > 0) return e.twd;
  return e.amount * (s.currencies.find((c) => c.code === e.currency)?.rate ?? 0);
}

/**
 * 換結算幣別：沿用使用者填的匯率交叉換算（新結算幣別不在清單裡才用市場匯率），
 * 原本的結算幣別變成一種外幣，支出金額本身不變。
 */
export function rebase(s: TripState, next: string, live: LiveRates): TripState {
  const old = baseOf(s);
  if (next === old) return s;
  // 1 單位 code = ? 單位舊結算幣別
  const inOld = (code: string) =>
    code === old ? 1 : (s.currencies.find((c) => c.code === code)?.rate ?? marketRate(code, old, live));
  const pivot = inOld(next);
  const codes = [old, ...s.currencies.map((c) => c.code)].filter((c) => c !== next);
  return {
    ...s,
    base: next,
    currencies: codes.map((code) => ({ code, rate: Number(formatRate(inOld(code) / pivot)) })),
    // 沒標幣別的支出原本是舊結算幣別，要標清楚；實付金額是舊幣別的數字，清掉
    expenses: s.expenses.map((e) => ({ ...e, currency: e.currency ?? old, twd: null })),
  };
}

/** 匯率好讀的寫法：保留 4 位有效數字 */
export const formatRate = (r: number) => (r >= 100 ? r.toFixed(1) : Number(r.toPrecision(4)).toString());


export const EXPENSE_PRESETS = ["住宿", "交通", "餐費", "門票", "伴手禮"];

/** 這筆支出由哪些人分（回傳 members 的索引）；沒選 = 所有人 */
export function splittersOf(e: Expense, members: Member[]) {
  const ids = new Set(members.map((m) => m.id));
  const picked = e.sharedBy.filter((id) => ids.has(id));
  if (picked.length === 0) return members.map((_, i) => i);
  return members.flatMap((m, i) => (picked.includes(m.id) ? [i] : []));
}

export function computeTrip(s: TripState) {
  const { members, expenses } = s;
  const spent = members.map(() => 0); // 每人實際付出
  const owed = members.map(() => 0); // 每人應分攤
  let total = 0;
  let missingPayer = 0;

  for (const e of expenses) {
    const amount = toBase(e, s);
    if (amount <= 0) continue;
    const payer = members.findIndex((m) => m.id === e.payerId);
    if (payer < 0) {
      missingPayer++;
      continue;
    }
    const who = splittersOf(e, members);
    total += amount;
    spent[payer] += amount;
    for (const i of who) owed[i] += amount / who.length;
  }

  const nets = members.map((_, i) => spent[i] - owed[i]);
  const debts = nets.map((v) => (v < -0.004 ? -v : 0));
  const transfers = settle(members, nets);
  const totalDebt = debts.reduce((a, b) => a + b, 0);
  const collected = members.reduce((sum, m, i) => sum + (m.paid ? debts[i] : 0), 0);

  return {
    total,
    spent,
    owed,
    nets,
    debts,
    transfers,
    collected,
    remaining: totalDebt - collected,
    average: members.length > 0 ? total / members.length : 0,
    progress:
      totalDebt > 0.004 ? Math.round((collected / totalDebt) * 100) : members.length > 0 ? 100 : 0,
    unpaidCount: members.filter((m, i) => debts[i] > 0 && !m.paid).length,
    warning: missingPayer > 0 ? `有 ${missingPayer} 筆支出還沒選付款人，暫不計入` : null,
  };
}
