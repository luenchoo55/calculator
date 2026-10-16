// 分帳計算：不含任何畫面，方便之後測試或重複使用

export type SplitMode = "equal" | "weight" | "items" | "fixed";

export type Person = {
  id: string;
  name: string;
  weight: number; // 依份數：喝酒的人 1.5 份、壽星 0 份
  paid: boolean; // 已把該付的錢轉給代墊的人
  advanced?: number; // 多人代墊：這個人先墊了多少
  fixed?: number | null; // 指定金額：null 代表跟其他人均分剩下的
  payInfo?: string; // 收款方式，例如 LINE Pay、銀行帳號
};

// 點餐模式的一道菜；sharedBy 空陣列 = 所有人一起分
export type Item = {
  id: string;
  name: string;
  price: number;
  sharedBy: string[];
};

export type State = {
  bill: number;
  serviceOn: boolean;
  serviceMode: "percent" | "fixed";
  serviceRate: number;
  serviceFixed: number;
  roundOn: boolean;
  splitMode: SplitMode;
  payerMode: "single" | "multi";
  payerId: string | null;
  people: Person[];
  items: Item[];
};

export type Transfer = { fromId: string; toId: string; amount: number };

export const SPLIT_MODES: { id: SplitMode; label: string; hint: string }[] = [
  { id: "equal", label: "平均", hint: "總金額所有人平均分攤" },
  { id: "weight", label: "份數", hint: "喝酒、食量大的人多算幾份，壽星設 ×0 免付" },
  { id: "items", label: "點餐", hint: "逐道菜選誰分，帳單沒列到的金額大家均分，服務費按比例分" },
  { id: "fixed", label: "指定", hint: "指定某些人付固定金額，其他人均分剩下的" },
];

const EPS = 0.004;

export function serviceAmount(s: State) {
  if (!s.serviceOn) return 0;
  return s.serviceMode === "percent" ? (s.bill * s.serviceRate) / 100 : s.serviceFixed;
}

/** 這道菜由哪些人分（回傳 people 的索引）；沒選或選的人都被刪掉時 = 所有人 */
export function sharersOf(item: Item, people: Person[]) {
  const ids = new Set(people.map((p) => p.id));
  const picked = item.sharedBy.filter((id) => ids.has(id));
  if (picked.length === 0) return people.map((_, i) => i);
  return people.flatMap((p, i) => (picked.includes(p.id) ? [i] : []));
}

/** 依分攤方式算出每人應付（未進位），並回傳需要提醒的訊息 */
export function rawShares(s: State, total: number): { shares: number[]; warning: string | null; note: string | null } {
  const { people } = s;
  const n = people.length;
  if (n === 0) return { shares: [], warning: null, note: null };

  switch (s.splitMode) {
    case "equal":
      return { shares: people.map(() => total / n), warning: null, note: null };

    case "weight": {
      const tw = people.reduce((sum, p) => sum + p.weight, 0);
      if (tw === 0) return { shares: people.map(() => 0), warning: "份數合計為 0，沒有人要付錢", note: null };
      return { shares: people.map((p) => (total * p.weight) / tw), warning: null, note: null };
    }

    case "items": {
      // 先算每人吃了多少（未含服務費），再依比例攤到含服務費的總計
      const base = people.map(() => 0);
      let listed = 0;
      for (const item of s.items) {
        const sharers = sharersOf(item, people);
        listed += item.price;
        for (const i of sharers) base[i] += item.price / sharers.length;
      }
      const shared = Math.max(0, s.bill - listed);
      for (let i = 0; i < n; i++) base[i] += shared / n;
      const sumBase = base.reduce((a, b) => a + b, 0);
      const shares = sumBase > 0 ? base.map((b) => (b / sumBase) * total) : people.map(() => total / n);
      return {
        shares,
        warning:
          listed > s.bill + EPS ? `品項合計 ${fmt(listed)} 超過帳單 ${fmt(s.bill)}，已按比例縮減` : null,
        note: shared > EPS ? `帳單中沒列出的 ${fmt(shared)} 當作共享，所有人均分` : null,
      };
    }

    case "fixed": {
      const fixedSum = people.reduce((sum, p) => sum + (p.fixed ?? 0), 0);
      const rest = people.filter((p) => p.fixed == null).length;
      const remainder = total - fixedSum;
      const each = rest > 0 ? Math.max(0, remainder) / rest : 0;
      let warning: string | null = null;
      if (remainder < -EPS) warning = `指定金額合計 ${fmt(fixedSum)} 超過總計 ${fmt(total)}`;
      else if (rest === 0 && Math.abs(remainder) > EPS)
        warning = `指定金額合計 ${fmt(fixedSum)}，與總計還差 ${fmt(remainder)}`;
      return {
        shares: people.map((p) => p.fixed ?? each),
        warning,
        note: rest > 0 ? `其餘 ${rest} 人均分剩下的 ${fmt(Math.max(0, remainder))}` : null,
      };
    }
  }
}

/**
 * 結算：正淨額 = 代墊的人該收，負淨額 = 該付。
 * 由欠最多的人先還給墊最多的人，盡量減少轉帳次數。
 */
export function settle(people: { id: string }[], nets: number[]): Transfer[] {
  const creditors = nets
    .map((amt, i) => ({ i, amt }))
    .filter((x) => x.amt > EPS)
    .sort((a, b) => b.amt - a.amt);
  const debtors = nets
    .map((v, i) => ({ i, amt: -v }))
    .filter((x) => x.amt > EPS)
    .sort((a, b) => b.amt - a.amt);

  const out: Transfer[] = [];
  const add = (from: number, to: number, amount: number) => {
    const hit = out.find((t) => t.fromId === people[from].id && t.toId === people[to].id);
    if (hit) hit.amount += amount;
    else out.push({ fromId: people[from].id, toId: people[to].id, amount });
  };

  let c = 0;
  for (const d of debtors) {
    while (d.amt > EPS && c < creditors.length) {
      const pay = Math.min(d.amt, creditors[c].amt);
      add(d.i, creditors[c].i, pay);
      d.amt -= pay;
      creditors[c].amt -= pay;
      if (creditors[c].amt <= EPS) c++;
    }
    // 無條件進位多出來的零頭，交給墊最多的人
    if (d.amt > EPS && creditors.length > 0) add(d.i, creditors[0].i, d.amt);
  }
  return out;
}

export function compute(s: State) {
  const { people, roundOn } = s;
  const service = serviceAmount(s);
  const total = s.bill + service;

  const { shares: raw, warning: splitWarning, note: splitNote } = rawShares(s, total);
  const shares = raw.map((v) => (roundOn ? Math.ceil(v - 1e-9) : Math.round(v * 100) / 100));
  const sumShares = shares.reduce((a, b) => a + b, 0);

  // 每個人先墊了多少
  const payer = people.find((p) => p.id === s.payerId) ?? people[0];
  const advances = people.map((p) =>
    s.payerMode === "single" ? (p.id === payer?.id ? total : 0) : (p.advanced ?? 0),
  );
  const advancedSum = advances.reduce((a, b) => a + b, 0);
  const payerWarning =
    s.payerMode === "multi" && people.length > 0 && Math.abs(advancedSum - total) > 0.5
      ? advancedSum === 0
        ? "請輸入每個人代墊的金額"
        : `代墊合計 ${fmt(advancedSum)}，帳單總計 ${fmt(total)}，${
            advancedSum > total ? "多了" : "還差"
          } ${fmt(Math.abs(total - advancedSum))}`
      : null;

  const nets = people.map((_, i) => advances[i] - shares[i]);
  const debts = nets.map((v) => (v < -EPS ? -v : 0));
  const transfers = settle(people, nets);

  const totalDebt = debts.reduce((a, b) => a + b, 0);
  const collected = people.reduce((sum, p, i) => sum + (p.paid ? debts[i] : 0), 0);

  return {
    service,
    total,
    shares,
    sumShares,
    nets,
    debts,
    transfers,
    advancedSum,
    payerId: payer?.id ?? null,
    collected,
    remaining: totalDebt - collected,
    extra: sumShares - total,
    average: people.length > 0 ? total / people.length : 0,
    progress:
      totalDebt > EPS ? Math.round((collected / totalDebt) * 100) : people.length > 0 ? 100 : 0,
    unpaidCount: people.filter((p, i) => debts[i] > 0 && !p.paid).length,
    splitWarning,
    splitNote,
    payerWarning,
  };
}

export const money = (n: number, decimals = 0) =>
  (Math.abs(n) < 0.005 ? 0 : n).toLocaleString("zh-TW", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const fmt = (n: number) => `$${money(n, Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2)}`;
