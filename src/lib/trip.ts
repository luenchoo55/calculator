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
  currency?: string; // 沒填 = 新台幣
};

// 外幣匯率：1 單位外幣 = rate 新台幣
export type Currency = { code: string; rate: number };

export type TripState = {
  id: string;
  title: string;
  currencies: Currency[];
  members: Member[];
  expenses: Expense[];
};

export const BASE_CURRENCY = "TWD";

// 常用外幣與參考匯率（只是預設值，使用者可自行修改）
export const CURRENCY_PRESETS: Currency[] = [
  { code: "JPY", rate: 0.21 },
  { code: "USD", rate: 32 },
  { code: "KRW", rate: 0.023 },
  { code: "EUR", rate: 35 },
  { code: "THB", rate: 0.95 },
];

/** 換算成新台幣 */
export function toBase(e: Expense, currencies: Currency[]) {
  if (!e.currency || e.currency === BASE_CURRENCY) return e.amount;
  return e.amount * (currencies.find((c) => c.code === e.currency)?.rate ?? 0);
}

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
    const amount = toBase(e, s.currencies);
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
