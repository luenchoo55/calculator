"use client";

import { useMemo } from "react";
import {
  Card,
  Header,
  Notice,
  Panel,
  PayInfoPanel,
  ProgressRing,
  SettleList,
  Stat,
  Toggle,
  chipClass,
  newId,
  shareText,
  toNumber,
  useStoredState,
  useToast,
} from "@/components/ui";
import { money } from "@/lib/split";
import {
  BASE_CURRENCY,
  CURRENCY_PRESETS,
  EXPENSE_PRESETS,
  computeTrip,
  splittersOf,
  toBase,
  type Expense,
  type Member,
  type TripState,
} from "@/lib/trip";

const STORAGE_KEY = "calculator-trips-v2";

// 可以存好幾個行程，currentId 是目前打開的那個
type TripBook = { currentId: string; trips: TripState[] };

// 範例：花蓮三天兩夜，每筆支出由不同人先付
const sampleHualien: TripState = {
  id: "t1",
  title: "花蓮三天兩夜",
  currencies: [],
  members: [
    { id: "m1", name: "小明", paid: false },
    { id: "m2", name: "阿華", paid: false },
    { id: "m3", name: "美美", paid: false },
    { id: "m4", name: "大雄", paid: true },
  ],
  expenses: [
    { id: "e1", name: "民宿兩晚", amount: 8000, payerId: "m1", sharedBy: [] },
    { id: "e2", name: "租車＋油錢", amount: 3600, payerId: "m2", sharedBy: [] },
    { id: "e3", name: "太魯閣午餐", amount: 1480, payerId: "m3", sharedBy: [] },
    { id: "e4", name: "海鮮晚餐", amount: 2800, payerId: "m4", sharedBy: [] },
    { id: "e5", name: "酒吧", amount: 900, payerId: "m2", sharedBy: ["m2", "m4"] },
    { id: "e6", name: "幫小明代買伴手禮", amount: 1200, payerId: "m3", sharedBy: ["m1"] },
  ],
};

// 範例：出國用日圓記帳，機票用台幣
const sampleTokyo: TripState = {
  id: "t2",
  title: "東京五日遊",
  currencies: [{ code: "JPY", rate: 0.21 }],
  members: [
    { id: "m1", name: "小明", paid: false },
    { id: "m2", name: "阿華", paid: false },
    { id: "m3", name: "美美", paid: false },
  ],
  expenses: [
    { id: "e1", name: "機票", amount: 27000, payerId: "m2", sharedBy: [] },
    { id: "e2", name: "飯店四晚", amount: 120000, payerId: "m1", sharedBy: [], currency: "JPY" },
    { id: "e3", name: "迪士尼門票", amount: 28200, payerId: "m3", sharedBy: [], currency: "JPY" },
    { id: "e4", name: "燒肉", amount: 15000, payerId: "m2", sharedBy: ["m1", "m2"], currency: "JPY" },
  ],
};

const defaultBook: TripBook = { currentId: "t1", trips: [sampleHualien, sampleTokyo] };

const blankTrip = (): TripState => ({ id: newId(), title: "新行程", currencies: [], members: [], expenses: [] });

export default function TripCalculator({ tabs }: { tabs: React.ReactNode }) {
  const [book, setBook] = useStoredState<TripBook>(STORAGE_KEY, defaultBook);
  const [toastNode, showToast] = useToast();
  const state = book.trips.find((t) => t.id === book.currentId) ?? book.trips[0] ?? sampleHualien;
  const calc = useMemo(() => computeTrip(state), [state]);
  const { members, expenses, currencies } = state;

  // 只改目前打開的行程
  const setState = (next: TripState | ((s: TripState) => TripState)) =>
    setBook((b) => {
      const cur = b.trips.find((t) => t.id === b.currentId) ?? b.trips[0] ?? sampleHualien;
      const value = typeof next === "function" ? next(cur) : next;
      const trips = b.trips.some((t) => t.id === cur.id)
        ? b.trips.map((t) => (t.id === cur.id ? { ...value, id: cur.id } : t))
        : [{ ...value, id: cur.id }];
      return { currentId: cur.id, trips };
    });

  const addTrip = () => {
    const t = blankTrip();
    setBook((b) => ({ currentId: t.id, trips: [...b.trips, t] }));
    showToast("已新增行程");
  };

  const deleteTrip = () => {
    if (book.trips.length <= 1) {
      setState((s) => ({ ...blankTrip(), id: s.id }));
      showToast("已清空行程");
      return;
    }
    setBook((b) => {
      const trips = b.trips.filter((t) => t.id !== state.id);
      return { currentId: trips[0].id, trips };
    });
    showToast("已刪除行程");
  };

  const currencyCodes = [BASE_CURRENCY, ...currencies.map((c) => c.code)];
  const nextCurrency = (e: Expense) => {
    const i = currencyCodes.indexOf(e.currency ?? BASE_CURRENCY);
    return currencyCodes[(i + 1) % currencyCodes.length];
  };

  const nameOf = (id: string) => members.find((m) => m.id === id)?.name || "?";
  const payInfoOf = (id: string) => members.find((m) => m.id === id)?.payInfo?.trim() || undefined;
  const maxSpent = Math.max(1, ...calc.spent);

  const updateMember = (id: string, patch: Partial<Member>) =>
    setState((s) => ({ ...s, members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));

  const removeMember = (id: string) =>
    setState((s) => ({
      ...s,
      members: s.members.filter((m) => m.id !== id),
      expenses: s.expenses.map((e) => ({
        ...e,
        payerId: e.payerId === id ? null : e.payerId,
        sharedBy: e.sharedBy.filter((x) => x !== id),
      })),
    }));

  const addMember = () =>
    setState((s) => ({
      ...s,
      members: [...s.members, { id: newId(), name: `旅伴 ${s.members.length + 1}`, paid: false }],
    }));

  const updateExpense = (id: string, patch: Partial<Expense>) =>
    setState((s) => ({ ...s, expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));

  const addExpense = (name = "") =>
    setState((s) => ({
      ...s,
      expenses: [...s.expenses, { id: newId(), name, amount: 0, payerId: s.members[0]?.id ?? null, sharedBy: [] }],
    }));

  // 「全部」= sharedBy 為空；點某人則只選他，再點其他人加入
  const toggleSharer = (e: Expense, id: string) => {
    const picked = e.sharedBy.filter((x) => members.some((m) => m.id === x));
    updateExpense(e.id, { sharedBy: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] });
  };

  const copySummary = async () => {
    const lines = [
      `${state.title || "出遊"} 分帳`,
      `總花費 NT$${money(calc.total)}（${expenses.length} 筆）`,
      "",
      ...expenses.map(
        (e) =>
          `・${e.name || "支出"} ${e.currency && e.currency !== BASE_CURRENCY ? `${e.currency} ${money(e.amount)} ≈ ` : ""}NT$${money(toBase(e, currencies))}（${e.payerId ? nameOf(e.payerId) : "?"} 付）`,
      ),
      "",
      ...members.map((m, i) => `${m.name}：付出 ${money(calc.spent[i])}／分攤 ${money(calc.owed[i])}`),
      "",
      "轉帳：",
      ...(calc.transfers.length > 0
        ? calc.transfers.map(
            (t) =>
              `${members.find((m) => m.id === t.fromId)?.paid ? "✓" : "○"} ${nameOf(t.fromId)} → ${nameOf(t.toId)}  NT$${money(t.amount)}${payInfoOf(t.toId) ? `（${payInfoOf(t.toId)}）` : ""}`,
          )
        : ["不需要轉帳"]),
    ];
    await shareText(lines.join("\n"), showToast);
  };

  return (
    <div className="w-full max-w-md select-none pb-10">
      <Header
        title="出遊分帳"
        sub="Trip"
        menu={[
          { label: "分享結果", onClick: copySummary },
          { label: "新增行程", onClick: addTrip },
          { label: "刪除此行程", onClick: deleteTrip },
          {
            label: "載入範例",
            onClick: () => {
              setBook(defaultBook);
              showToast("已載入範例資料");
            },
          },
        ]}
      />
      {tabs}

      {/* 行程切換 */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {book.trips.map((t) => (
          <button
            key={t.id}
            className={chipClass(t.id === state.id, "sm")}
            onClick={() => setBook((b) => ({ ...b, currentId: t.id }))}
          >
            {t.title || "未命名"}
          </button>
        ))}
        <button className={chipClass(false, "sm")} onClick={addTrip}>
          + 新行程
        </button>
      </div>

      {/* 行程名稱 + 總花費 + 還款進度 */}
      <section className="flex items-center gap-3 rounded-full border-[1.5px] border-line py-2 pl-5 pr-2">
        <div className="min-w-0 flex-1 leading-tight">
          <input
            value={state.title}
            placeholder="行程名稱"
            onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
            className="w-full bg-transparent text-[15px] outline-none placeholder:text-muted"
            aria-label="行程名稱"
          />
          <div className="text-[11px] text-muted">
            {members.length === 0
              ? "新增旅伴開始記帳"
              : calc.unpaidCount > 0
                ? `還有 ${calc.unpaidCount} 人未還款…`
                : "全部結清，辛苦了！"}
          </div>
        </div>
        <div className="shrink-0 font-mono text-[26px] leading-none tracking-tight">
          <span className="text-sm text-muted">$</span>
          {money(calc.total)}
        </div>
        <ProgressRing value={calc.progress} />
      </section>

      {/* 兩張資訊卡 */}
      <section className="mt-3 grid grid-cols-2 gap-3">
        <Card title="MEMBERS" sub={`${members.length} 人`}>
          <div className="flex gap-3">
            <div className="flex h-[92px] flex-1 items-end gap-[3px] overflow-hidden">
              {members.length === 0 && <span className="text-[11px] text-muted">—</span>}
              {members.map((m, i) => (
                <div
                  key={m.id}
                  title={`${m.name} 付出 $${money(calc.spent[i])}`}
                  className={`min-w-[4px] max-w-[9px] flex-1 rounded-full border-[1.5px] border-line transition-all ${
                    calc.debts[i] === 0 || m.paid ? "bg-line" : ""
                  }`}
                  style={{ height: `${Math.max(12, (calc.spent[i] / maxSpent) * 100)}%` }}
                />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Stat label="人均" value={money(calc.average)} />
              <Stat label="已還" value={money(calc.collected)} />
            </div>
          </div>
          <div className="mt-auto pt-3 text-[10px] leading-snug text-muted">直條高度 = 每人付出多少</div>
        </Card>

        <Card title="TOTAL" sub="所有支出">
          <Stat label="總花費" value={money(calc.total)} big />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Stat label="筆數" value={`${expenses.length}`} />
            <Stat label="未還" value={money(calc.remaining)} />
          </div>
          <div className="mt-auto pt-3">
            <Stat label="需轉帳" value={`${calc.transfers.length} 筆`} />
          </div>
        </Card>
      </section>

      {/* 支出明細 */}
      <Panel title="EXPENSES" sub="每筆支出：誰付、誰分">
        <div className="flex flex-wrap gap-1.5">
          {EXPENSE_PRESETS.map((name) => (
            <button key={name} className={chipClass(false, "sm")} onClick={() => addExpense(name)}>
              + {name}
            </button>
          ))}
        </div>
        <div className="mt-3 border-t-[1.5px] border-line">
          {expenses.map((e) => {
            const who = splittersOf(e, members);
            const all = e.sharedBy.filter((x) => members.some((m) => m.id === x)).length === 0;
            return (
              <div key={e.id} className="border-b border-soft py-2.5">
                <div className="flex items-center gap-2 font-mono text-[13px]">
                  <input
                    value={e.name}
                    placeholder="支出名稱"
                    onChange={(ev) => updateExpense(e.id, { name: ev.target.value })}
                    className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:font-normal placeholder:text-muted"
                    aria-label="支出名稱"
                  />
                  {currencies.length > 0 ? (
                    <button
                      onClick={() => updateExpense(e.id, { currency: nextCurrency(e) })}
                      className="rounded-full border border-line px-1.5 text-[10px] leading-5 hover:bg-soft"
                      aria-label="切換幣別"
                    >
                      {e.currency ?? BASE_CURRENCY}
                    </button>
                  ) : (
                    <span className="text-muted">$</span>
                  )}
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={e.amount || ""}
                    placeholder="0"
                    onChange={(ev) => updateExpense(e.id, { amount: toNumber(ev.target.value) })}
                    className="w-[7ch] bg-transparent text-right outline-none placeholder:text-soft"
                    aria-label="支出金額"
                  />
                  <button
                    onClick={() => setState((s) => ({ ...s, expenses: s.expenses.filter((x) => x.id !== e.id) }))}
                    aria-label="刪除支出"
                    className="w-4 text-muted opacity-40 hover:rotate-90 hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="w-7 shrink-0 font-mono text-[10px] text-muted">付款</span>
                  {members.map((m) => (
                    <button
                      key={m.id}
                      className={chipClass(e.payerId === m.id, "sm")}
                      onClick={() => updateExpense(e.id, { payerId: m.id })}
                    >
                      {m.name || "?"}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="w-7 shrink-0 font-mono text-[10px] text-muted">分攤</span>
                  <button className={chipClass(all, "sm")} onClick={() => updateExpense(e.id, { sharedBy: [] })}>
                    全部
                  </button>
                  {members.map((m) => (
                    <button
                      key={m.id}
                      className={chipClass(!all && e.sharedBy.includes(m.id), "sm")}
                      onClick={() => toggleSharer(e, m.id)}
                    >
                      {m.name || "?"}
                    </button>
                  ))}
                  {who.length > 0 && e.amount > 0 && (
                    <span className="ml-auto font-mono text-[10px] text-muted">
                      {e.currency && e.currency !== BASE_CURRENCY && `≈ NT$${money(toBase(e, currencies))}・`}
                      {who.length} 人・每人 ${money(toBase(e, currencies) / who.length)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {expenses.length === 0 && (
            <p className="py-4 text-center font-mono text-[12px] text-muted">點上面的按鈕新增第一筆支出</p>
          )}
        </div>
        <div className="pt-2 font-mono text-[11px]">
          <button onClick={() => addExpense()} className="font-medium transition-[translate] hover:translate-x-1 hover:underline">
            +ADD 新增支出
          </button>
        </div>
        <Notice warning={calc.warning} />
      </Panel>

      {/* 外幣匯率 */}
      <Panel title="CURRENCY" sub="外幣匯率（換算成新台幣結算）">
        {currencies.map((c) => (
          <div key={c.code} className="flex items-center gap-2 border-b border-soft py-1.5 font-mono text-[13px]">
            <span className="flex-1">
              1 {c.code} <span className="text-muted">=</span>
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={c.rate || ""}
              onChange={(ev) =>
                setState((s) => ({
                  ...s,
                  currencies: s.currencies.map((x) => (x.code === c.code ? { ...x, rate: toNumber(ev.target.value) } : x)),
                }))
              }
              className="w-[8ch] bg-transparent text-right outline-none"
              aria-label={`${c.code} 匯率`}
            />
            <span className="text-muted">TWD</span>
            <button
              onClick={() =>
                setState((s) => ({
                  ...s,
                  currencies: s.currencies.filter((x) => x.code !== c.code),
                  expenses: s.expenses.map((ex) => (ex.currency === c.code ? { ...ex, currency: undefined } : ex)),
                }))
              }
              aria-label={`移除 ${c.code}`}
              className="w-4 text-muted opacity-40 hover:rotate-90 hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CURRENCY_PRESETS.filter((p) => !currencies.some((c) => c.code === p.code)).map((p) => (
            <button
              key={p.code}
              className={chipClass(false, "sm")}
              onClick={() => setState((s) => ({ ...s, currencies: [...s.currencies, p] }))}
            >
              + {p.code}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-snug text-muted">
          預設匯率僅供參考，請改成實際刷卡或換匯的匯率；加入外幣後，點支出旁的幣別可以切換
        </p>
      </Panel>

      {/* 每人收支 */}
      <section className="mt-5">
        <div className="flex items-center justify-between pb-2 font-mono text-[11px] tracking-wider">
          <button onClick={addMember} className="font-medium transition-[translate] hover:translate-x-1 hover:underline">
            +ADD 新增旅伴
          </button>
          <span className="text-muted">付出 ・ 分攤 ・ 已還</span>
        </div>
        <ul className="border-t-[1.5px] border-line">
          {members.map((m, i) => {
            const owes = calc.debts[i] > 0;
            return (
              <li
                key={m.id}
                className={`flex items-center gap-2 border-b border-soft py-2.5 font-mono text-[13px] ${
                  owes && !m.paid ? "font-semibold" : "text-muted"
                }`}
              >
                <button
                  onClick={() => removeMember(m.id)}
                  aria-label={`移除 ${m.name}`}
                  className="w-4 shrink-0 text-muted opacity-40 hover:rotate-90 hover:opacity-100"
                >
                  ×
                </button>
                <input
                  value={m.name}
                  onChange={(e) => updateMember(m.id, { name: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent uppercase text-foreground outline-none"
                  aria-label="名字"
                />
                <span className="w-[7ch] shrink-0 text-right font-normal text-muted">${money(calc.spent[i])}</span>
                <span className="w-[7ch] shrink-0 text-right">${money(calc.owed[i])}</span>
                {owes ? (
                  <Toggle on={m.paid} onChange={(v) => updateMember(m.id, { paid: v })} label={`${m.name} 已還`} />
                ) : (
                  <span className="flex h-6 w-11 shrink-0 items-center justify-center rounded-full border border-soft text-[10px] font-normal">
                    {calc.nets[i] > 0.004 ? "應收" : "—"}
                  </span>
                )}
              </li>
            );
          })}
          {members.length === 0 && (
            <li className="py-6 text-center font-mono text-[12px] text-muted">還沒有旅伴，按 +ADD 新增</li>
          )}
        </ul>
      </section>

      <PayInfoPanel
        receivers={members.filter((_, i) => calc.nets[i] > 0.004)}
        onChange={(id, payInfo) => updateMember(id, { payInfo })}
      />

      {members.length > 0 && (
        <SettleList
          transfers={calc.transfers}
          nameOf={nameOf}
          payInfoOf={payInfoOf}
          isPaid={(id) => !!members.find((m) => m.id === id)?.paid}
          onToggle={(id) =>
            setState((s) => ({ ...s, members: s.members.map((m) => (m.id === id ? { ...m, paid: !m.paid } : m)) }))
          }
        />
      )}

      <p className="mt-6 text-center font-mono text-[10px] tracking-widest text-muted">
        資料只存在這台裝置的瀏覽器
      </p>

      {toastNode}
    </div>
  );
}
