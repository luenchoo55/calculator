"use client";

import { useMemo } from "react";
import {
  Card,
  Header,
  Notice,
  OnOff,
  Panel,
  PayInfoPanel,
  ProgressRing,
  RoundButton,
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
import {
  SPLIT_MODES,
  compute,
  money,
  sharersOf,
  type Item,
  type Person,
  type State,
} from "@/lib/split";

const STORAGE_KEY = "calculator-split-v1";

// 範例：8 人火鍋聚餐。小明先刷卡；烤鴨只有小明和阿華分，啤酒只有喝酒的三個人分
const defaultState: State = {
  bill: 6880,
  serviceOn: true,
  serviceMode: "percent",
  serviceRate: 10,
  serviceFixed: 0,
  roundOn: true,
  splitMode: "weight",
  payerMode: "single",
  payerId: "p1",
  people: [
    { id: "p1", name: "小明", weight: 1, paid: false, advanced: 5000, fixed: null },
    { id: "p2", name: "阿華", weight: 1.5, paid: true, advanced: 2568, fixed: null },
    { id: "p3", name: "美美", weight: 1, paid: false, advanced: 0, fixed: 0 },
    { id: "p4", name: "大雄", weight: 1.5, paid: false, advanced: 0, fixed: null },
    { id: "p5", name: "靜香", weight: 1, paid: true, advanced: 0, fixed: null },
    { id: "p6", name: "胖虎", weight: 2, paid: false, advanced: 0, fixed: null },
    { id: "p7", name: "小夫", weight: 1, paid: false, advanced: 0, fixed: null },
    { id: "p8", name: "小咪", weight: 0.5, paid: false, advanced: 0, fixed: null },
  ],
  items: [
    { id: "i1", name: "火鍋套餐", price: 4200, sharedBy: [] },
    { id: "i2", name: "烤鴨", price: 880, sharedBy: ["p1", "p2"] },
    { id: "i3", name: "啤酒", price: 600, sharedBy: ["p2", "p4", "p6"] },
    { id: "i4", name: "兒童餐", price: 280, sharedBy: ["p8"] },
  ],
};

export default function SplitCalculator({ tabs }: { tabs: React.ReactNode }) {
  const [state, setState] = useStoredState<State>(STORAGE_KEY, defaultState);
  const [toastNode, showToast] = useToast();

  const update = (patch: Partial<State>) => setState((s) => ({ ...s, ...patch }));

  const updatePerson = (id: string, patch: Partial<Person>) =>
    setState((s) => ({
      ...s,
      people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));

  const addPerson = () =>
    setState((s) => ({
      ...s,
      people: [
        ...s.people,
        { id: newId(), name: `朋友 ${s.people.length + 1}`, weight: 1, paid: false, advanced: 0, fixed: null },
      ],
    }));

  const removePerson = (id: string) =>
    setState((s) => ({
      ...s,
      people: s.people.filter((p) => p.id !== id),
      items: s.items.map((it) => ({ ...it, sharedBy: it.sharedBy.filter((x) => x !== id) })),
    }));

  const updateItem = (id: string, patch: Partial<Item>) =>
    setState((s) => ({
      ...s,
      items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));

  const calc = useMemo(() => compute(state), [state]);
  const decimals = state.roundOn ? 0 : 2;
  const payInfoOf = (id: string) => state.people.find((p) => p.id === id)?.payInfo?.trim() || undefined;
  const nameOf = (id: string) => state.people.find((p) => p.id === id)?.name ?? "?";
  const maxShare = Math.max(1, ...calc.shares);
  const modeLabel = SPLIT_MODES.find((m) => m.id === state.splitMode)?.label ?? "";

  const copySummary = async () => {
    const service = !state.serviceOn
      ? ""
      : ` + 服務費 ${state.serviceMode === "percent" ? `${state.serviceRate}%` : `NT$${money(state.serviceFixed)}`}`;
    const lines = [
      `聚餐分帳（${modeLabel}）`,
      `帳單 NT$${money(state.bill)}${service} = NT$${money(calc.total, 2)}`,
      "",
      ...state.people.map((p, i) => `${p.name}：NT$${money(calc.shares[i], decimals)}`),
      "",
      "轉帳：",
      ...(calc.transfers.length > 0
        ? calc.transfers.map((t) => {
            const from = state.people.find((p) => p.id === t.fromId);
            return `${from?.paid ? "✓" : "○"} ${nameOf(t.fromId)} → ${nameOf(t.toId)}  NT$${money(t.amount, decimals)}${payInfoOf(t.toId) ? `（${payInfoOf(t.toId)}）` : ""}`;
          })
        : ["不需要轉帳"]),
    ];
    await shareText(lines.join("\n"), showToast);
  };

  const loadSample = () => {
    setState(defaultState);
    showToast("已載入範例資料");
  };

  const resetAll = () => {
    setState({ ...defaultState, bill: 0, people: [], items: [], payerId: null });
    showToast("已重設");
  };

  return (
    <div className="w-full max-w-md select-none pb-10">
      <Header
        title="聚餐分帳"
        sub="Split"
        menu={[
          { label: "分享結果", onClick: copySummary },
          { label: "載入範例", onClick: loadSample },
          { label: "全部重設", onClick: resetAll },
        ]}
      />
      {tabs}

      {/* 帳單金額 + 還款進度 */}
      <section className="flex items-center gap-3 rounded-full border-[1.5px] border-line py-2 pl-2 pr-2">
        <RoundButton label="減少 100" onClick={() => update({ bill: Math.max(0, state.bill - 100) })}>
          −
        </RoundButton>
        <label className="flex min-w-0 items-baseline font-mono">
          <span className="text-sm text-muted">$</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={state.bill === 0 ? "" : state.bill}
            placeholder="0"
            onChange={(e) => update({ bill: toNumber(e.target.value) })}
            className="w-[5.5ch] min-w-0 bg-transparent text-[30px] leading-none tracking-tight outline-none placeholder:text-muted"
            aria-label="帳單金額"
          />
        </label>
        <RoundButton label="增加 100" onClick={() => update({ bill: state.bill + 100 })}>
          +
        </RoundButton>
        <p className="min-w-0 flex-1 text-[11px] leading-tight text-muted">
          {state.people.length === 0
            ? "新增朋友開始分帳"
            : calc.unpaidCount > 0
              ? `還有 ${calc.unpaidCount} 人未還款…`
              : "全部結清，辛苦了！"}
        </p>
        <ProgressRing value={calc.progress} />
      </section>

      {/* 兩張資訊卡 */}
      <section className="mt-3 grid grid-cols-2 gap-3">
        <Card title="PEOPLE" sub={`${state.people.length} 人`}>
          <div className="flex gap-3">
            <div className="flex h-[92px] flex-1 items-end gap-[3px] overflow-hidden">
              {state.people.length === 0 && <span className="text-[11px] text-muted">—</span>}
              {state.people.map((p, i) => {
                const done = calc.debts[i] === 0 || p.paid;
                return (
                  <button
                    key={p.id}
                    title={`${p.name} $${money(calc.shares[i], decimals)}`}
                    onClick={() => calc.debts[i] > 0 && updatePerson(p.id, { paid: !p.paid })}
                    className={`min-w-[4px] max-w-[9px] flex-1 rounded-full border-[1.5px] border-line transition-all ${done ? "bg-line" : ""}`}
                    style={{ height: `${Math.max(12, (calc.shares[i] / maxShare) * 100)}%` }}
                  />
                );
              })}
            </div>
            <div className="flex flex-col gap-2">
              <Stat label="人均" value={money(calc.average, 0)} />
              <Stat label="已還" value={money(calc.collected, decimals)} />
            </div>
          </div>
          <div className="mt-auto pt-3">
            <Stat label="分攤方式" value={modeLabel} />
          </div>
        </Card>

        <Card title="TOTAL" sub="含服務費">
          <Stat label="總計" value={money(calc.total, Number.isInteger(calc.total) ? 0 : 2)} big />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Stat label="服務費" value={`+${money(calc.service, 0)}`} />
            <Stat label="未還" value={money(calc.remaining, decimals)} />
          </div>
          <OnOff
            label="無條件進位"
            on={state.roundOn}
            onChange={(v) => update({ roundOn: v })}
            extra={calc.extra > 0.004 ? <span className="text-muted">+{money(calc.extra, 0)}</span> : null}
          />
        </Card>
      </section>

      {/* 分攤方式 */}
      <Panel title="SPLIT" sub="分攤方式">
        <div className="flex flex-wrap gap-2">
          {SPLIT_MODES.map((m) => (
            <button key={m.id} className={chipClass(state.splitMode === m.id)} onClick={() => update({ splitMode: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted">
          {SPLIT_MODES.find((m) => m.id === state.splitMode)?.hint}
        </p>
        {state.splitMode === "items" && (
          <ItemsEditor
            state={state}
            onUpdate={updateItem}
            onAdd={() =>
              update({ items: [...state.items, { id: newId(), name: "", price: 0, sharedBy: [] }] })
            }
            onRemove={(id) => update({ items: state.items.filter((it) => it.id !== id) })}
          />
        )}
        <Notice warning={calc.splitWarning} note={calc.splitNote} />
      </Panel>

      {/* 服務費 */}
      <ServicePanel state={state} amount={calc.service} onChange={update} />

      {/* 誰代墊 */}
      <Panel
        title="PAID BY"
        sub="誰先代墊"
        right={
          <div className="flex overflow-hidden rounded-full border-[1.5px] border-line font-mono text-[11px]">
            {(["single", "multi"] as const).map((m) => (
              <button
                key={m}
                onClick={() => update({ payerMode: m })}
                className={`px-2.5 py-1 ${state.payerMode === m ? "bg-line text-background" : ""}`}
              >
                {m === "single" ? "一人" : "多人"}
              </button>
            ))}
          </div>
        }
      >
        {state.people.length === 0 && <p className="text-[11px] text-muted">先新增朋友</p>}
        {state.payerMode === "single" ? (
          <div className="flex flex-wrap gap-2">
            {state.people.map((p) => (
              <button key={p.id} className={chipClass(calc.payerId === p.id)} onClick={() => update({ payerId: p.id })}>
                {p.name || "?"}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {state.people.map((p) => (
              <label key={p.id} className="flex items-center gap-1 border-b border-soft py-1 font-mono text-[13px]">
                <span className="min-w-0 flex-1 truncate">{p.name || "?"}</span>
                <span className="text-muted">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={p.advanced ? p.advanced : ""}
                  placeholder="0"
                  onChange={(e) => updatePerson(p.id, { advanced: toNumber(e.target.value) })}
                  className="w-[7ch] bg-transparent text-right outline-none placeholder:text-soft"
                  aria-label={`${p.name} 代墊金額`}
                />
              </label>
            ))}
          </div>
        )}
        {state.payerMode === "multi" && state.people.length > 0 && (
          <p className="mt-2 font-mono text-[11px] text-muted">
            代墊合計 ${money(calc.advancedSum, 0)}／總計 ${money(calc.total, 0)}
          </p>
        )}
        <Notice warning={calc.payerWarning} />
      </Panel>

      {/* 人員列表 */}
      <section className="mt-5">
        <div className="flex items-center justify-between pb-2 font-mono text-[11px] tracking-wider">
          <button onClick={addPerson} className="font-medium transition-[translate] hover:translate-x-1 hover:underline">
            +ADD 新增朋友
          </button>
          <span className="text-muted">
            {state.splitMode === "weight" ? "份數 ・ " : state.splitMode === "fixed" ? "指定 ・ " : ""}應付 ・ 已還
          </span>
        </div>
        <ul className="border-t-[1.5px] border-line">
          {state.people.map((p, i) => {
            const owes = calc.debts[i] > 0;
            const receives = calc.nets[i] > 0.004;
            return (
              <li
                key={p.id}
                className={`flex items-center gap-2 border-b border-soft py-2.5 font-mono text-[13px] ${
                  owes && !p.paid ? "font-semibold" : "text-muted"
                }`}
              >
                <button
                  onClick={() => removePerson(p.id)}
                  aria-label={`移除 ${p.name}`}
                  className="w-4 shrink-0 text-muted opacity-40 hover:rotate-90 hover:opacity-100"
                >
                  ×
                </button>
                <input
                  value={p.name}
                  onChange={(e) => updatePerson(p.id, { name: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent uppercase text-foreground outline-none"
                  aria-label="名字"
                />
                {state.splitMode === "weight" && (
                  <div className="flex shrink-0 items-center font-normal text-foreground">
                    <button
                      aria-label="減少份數"
                      onClick={() => updatePerson(p.id, { weight: Math.max(0, p.weight - 0.5) })}
                      className="px-1.5 text-muted hover:text-foreground"
                    >
                      −
                    </button>
                    <span className="w-[4ch] text-center">×{p.weight}</span>
                    <button
                      aria-label="增加份數"
                      onClick={() => updatePerson(p.id, { weight: p.weight + 0.5 })}
                      className="px-1.5 text-muted hover:text-foreground"
                    >
                      +
                    </button>
                  </div>
                )}
                {state.splitMode === "fixed" && (
                  <label className="flex shrink-0 items-center rounded-full border border-soft px-2 font-normal text-foreground">
                    <span className="text-muted">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={p.fixed ?? ""}
                      placeholder="均分"
                      onChange={(e) =>
                        updatePerson(p.id, { fixed: e.target.value === "" ? null : toNumber(e.target.value) })
                      }
                      className="w-[6ch] bg-transparent text-right outline-none placeholder:text-muted"
                      aria-label={`${p.name} 指定金額`}
                    />
                  </label>
                )}
                <span className="w-[7ch] shrink-0 text-right">${money(calc.shares[i], decimals)}</span>
                {owes ? (
                  <Toggle on={p.paid} onChange={(v) => updatePerson(p.id, { paid: v })} label={`${p.name} 已還`} />
                ) : (
                  <span className="flex h-6 w-11 shrink-0 items-center justify-center rounded-full border border-soft text-[10px] font-normal">
                    {receives ? "代墊" : "—"}
                  </span>
                )}
              </li>
            );
          })}
          {state.people.length === 0 && (
            <li className="py-6 text-center font-mono text-[12px] text-muted">還沒有人，按 +ADD 新增</li>
          )}
        </ul>
      </section>

      {/* 結算：誰要轉帳給誰 */}
      <PayInfoPanel
        receivers={state.people.filter((_, i) => calc.nets[i] > 0.004)}
        onChange={(id, payInfo) => updatePerson(id, { payInfo })}
      />

      {state.people.length > 0 && (
        <SettleList
          transfers={calc.transfers}
          nameOf={nameOf}
          payInfoOf={payInfoOf}
          decimals={decimals}
          isPaid={(id) => !!state.people.find((p) => p.id === id)?.paid}
          onToggle={(id) => setState((s) => ({ ...s, people: s.people.map((p) => (p.id === id ? { ...p, paid: !p.paid } : p)) }))}
        />
      )}

      <p className="mt-6 text-center font-mono text-[10px] tracking-widest text-muted">
        資料只存在這台裝置的瀏覽器
      </p>

      {toastNode}
    </div>
  );
}

function ItemsEditor({
  state,
  onUpdate,
  onAdd,
  onRemove,
}: {
  state: State;
  onUpdate: (id: string, patch: Partial<Item>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const { people, items } = state;
  const listed = items.reduce((sum, it) => sum + it.price, 0);

  // 「全部」= sharedBy 為空；點某人則只選他，再點其他人加入
  const togglePerson = (item: Item, id: string) => {
    const ids = new Set(people.map((p) => p.id));
    const picked = item.sharedBy.filter((x) => ids.has(x));
    onUpdate(item.id, {
      sharedBy: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id],
    });
  };

  return (
    <div className="mt-3 border-t-[1.5px] border-line">
      {items.map((it) => {
        const sharers = sharersOf(it, people);
        const all = sharers.length === people.length && it.sharedBy.filter((x) => people.some((p) => p.id === x)).length === 0;
        return (
          <div key={it.id} className="border-b border-soft py-2.5">
            <div className="flex items-center gap-2 font-mono text-[13px]">
              <input
                value={it.name}
                placeholder="品項名稱"
                onChange={(e) => onUpdate(it.id, { name: e.target.value })}
                className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:font-normal placeholder:text-muted"
                aria-label="品項名稱"
              />
              <span className="text-muted">$</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={it.price || ""}
                placeholder="0"
                onChange={(e) => onUpdate(it.id, { price: toNumber(e.target.value) })}
                className="w-[7ch] bg-transparent text-right outline-none placeholder:text-soft"
                aria-label="品項金額"
              />
              <button
                onClick={() => onRemove(it.id)}
                aria-label="刪除品項"
                className="w-4 text-muted opacity-40 hover:rotate-90 hover:opacity-100"
              >
                ×
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button className={chipClass(all, "sm")} onClick={() => onUpdate(it.id, { sharedBy: [] })}>
                全部
              </button>
              {people.map((p) => (
                <button key={p.id} className={chipClass(!all && it.sharedBy.includes(p.id), "sm")} onClick={() => togglePerson(it, p.id)}>
                  {p.name || "?"}
                </button>
              ))}
              {sharers.length > 0 && it.price > 0 && (
                <span className="ml-auto font-mono text-[10px] text-muted">
                  {sharers.length} 人・每人 ${money(it.price / sharers.length, 0)}
                </span>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-2 font-mono text-[11px]">
        <button onClick={onAdd} className="font-medium transition-[translate] hover:translate-x-1 hover:underline">
          +ADD 新增品項
        </button>
        <span className="text-muted">
          品項 ${money(listed, 0)}／帳單 ${money(state.bill, 0)}
        </span>
      </div>
    </div>
  );
}

const SERVICE_PRESETS = [5, 10, 15];

function ServicePanel({
  state,
  amount,
  onChange,
}: {
  state: State;
  amount: number;
  onChange: (patch: Partial<State>) => void;
}) {
  const { serviceOn, serviceMode, serviceRate, serviceFixed } = state;
  const isPreset = serviceOn && serviceMode === "percent" && SERVICE_PRESETS.includes(serviceRate);
  const isCustom = serviceOn && !isPreset;
  const customValue = serviceMode === "percent" ? serviceRate : serviceFixed;

  const setCustom = (raw: string) => {
    const n = toNumber(raw);
    onChange(
      serviceMode === "percent"
        ? { serviceOn: true, serviceRate: Math.min(100, n) }
        : { serviceOn: true, serviceFixed: n },
    );
  };

  return (
    <Panel
      title="SERVICE"
      sub="服務費"
      right={
        <div className="font-mono text-[15px]">
          {serviceOn ? `+${money(amount, 0)}` : <span className="text-muted">不收</span>}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <button className={chipClass(!serviceOn)} onClick={() => onChange({ serviceOn: false })}>
          OFF
        </button>
        {SERVICE_PRESETS.map((r) => (
          <button
            key={r}
            className={chipClass(isPreset && serviceRate === r)}
            onClick={() => onChange({ serviceOn: true, serviceMode: "percent", serviceRate: r })}
          >
            {r}%
          </button>
        ))}
        {/* 自訂：可輸入百分比或固定金額 */}
        <div
          className={`flex h-8 min-w-[150px] flex-1 items-center gap-1 rounded-full border-[1.5px] border-line pl-3 pr-1 font-mono text-[13px] ${
            isCustom ? "bg-soft" : ""
          }`}
        >
          <span className="shrink-0 text-[11px] text-muted">自訂</span>
          {serviceMode === "fixed" && <span className="text-muted">$</span>}
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={serviceMode === "percent" ? 100 : undefined}
            value={isCustom && customValue !== 0 ? customValue : ""}
            placeholder={serviceMode === "percent" ? "12" : "300"}
            onChange={(e) => setCustom(e.target.value)}
            className="w-0 min-w-[3ch] flex-1 bg-transparent text-right outline-none placeholder:text-muted"
            aria-label={serviceMode === "percent" ? "自訂服務費百分比" : "自訂服務費金額"}
          />
          <div className="flex shrink-0 overflow-hidden rounded-full border border-line text-[11px]">
            {(["percent", "fixed"] as const).map((m) => (
              <button
                key={m}
                onClick={() => onChange({ serviceMode: m, serviceOn: true })}
                className={`px-2 py-0.5 ${serviceMode === m ? "bg-line text-background" : ""}`}
                aria-label={m === "percent" ? "以百分比計算" : "以固定金額計算"}
              >
                {m === "percent" ? "%" : "$"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
