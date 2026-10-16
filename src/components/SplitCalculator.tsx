"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Person = {
  id: string;
  name: string;
  weight: number; // 份數，例如喝酒的人算 1.5 份
  paid: boolean;
};

type State = {
  bill: number;
  serviceOn: boolean;
  serviceRate: number;
  roundOn: boolean;
  people: Person[];
};

const STORAGE_KEY = "calculator-split-v1";

const defaultState: State = {
  bill: 3200,
  serviceOn: true,
  serviceRate: 10,
  roundOn: true,
  people: [
    { id: "p1", name: "小明", weight: 1, paid: true },
    { id: "p2", name: "阿華", weight: 1, paid: false },
    { id: "p3", name: "美美", weight: 1, paid: false },
    { id: "p4", name: "大雄", weight: 1.5, paid: false },
  ],
};

const newId = () => Math.random().toString(36).slice(2, 9);

const money = (n: number, decimals = 0) =>
  n.toLocaleString("zh-TW", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export default function SplitCalculator() {
  const [state, setState] = useState<State>(defaultState);
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // 讀取上次的資料
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState({ ...defaultState, ...JSON.parse(raw) });
    } catch {}
    setLoaded(true);
  }, []);

  // 自動儲存
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state, loaded]);

  // 點選單外面就關閉
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const update = (patch: Partial<State>) =>
    setState((s) => ({ ...s, ...patch }));

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
        { id: newId(), name: `朋友 ${s.people.length + 1}`, weight: 1, paid: false },
      ],
    }));

  const removePerson = (id: string) =>
    setState((s) => ({ ...s, people: s.people.filter((p) => p.id !== id) }));

  const calc = useMemo(() => {
    const { bill, serviceOn, serviceRate, roundOn, people } = state;
    const service = serviceOn ? (bill * serviceRate) / 100 : 0;
    const total = bill + service;
    const totalWeight = people.reduce((sum, p) => sum + p.weight, 0);
    const shares = people.map((p) => {
      const raw = totalWeight > 0 ? (total * p.weight) / totalWeight : 0;
      return roundOn ? Math.ceil(raw) : Math.round(raw * 100) / 100;
    });
    const sumShares = shares.reduce((a, b) => a + b, 0);
    const collected = people.reduce((sum, p, i) => sum + (p.paid ? shares[i] : 0), 0);
    const perUnit = totalWeight > 0 ? total / totalWeight : 0;
    return {
      service,
      total,
      shares,
      sumShares,
      collected,
      remaining: sumShares - collected,
      extra: sumShares - total,
      perUnit: roundOn ? Math.ceil(perUnit) : perUnit,
      progress: sumShares > 0 ? Math.round((collected / sumShares) * 100) : 0,
      paidCount: people.filter((p) => p.paid).length,
    };
  }, [state]);

  const decimals = state.roundOn ? 0 : 2;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  };

  const copySummary = async () => {
    const lines = [
      `聚餐分帳`,
      `帳單 NT$${money(state.bill)}${state.serviceOn ? ` + 服務費 ${state.serviceRate}%` : ""} = NT$${money(calc.total, 2)}`,
      ...state.people.map(
        (p, i) =>
          `${p.paid ? "✓" : "○"} ${p.name}${p.weight !== 1 ? ` (×${p.weight})` : ""}：NT$${money(calc.shares[i], decimals)}`,
      ),
      `已收 NT$${money(calc.collected, decimals)}／未收 NT$${money(calc.remaining, decimals)}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast("已複製分帳結果");
    } catch {
      showToast("複製失敗");
    }
    setMenuOpen(false);
  };

  const resetAll = () => {
    setState({ ...defaultState, bill: 0, people: [] });
    setMenuOpen(false);
    showToast("已重設");
  };

  return (
    <div className="w-full max-w-md select-none">
      {/* 標題列 */}
      <header className="flex items-center justify-between pb-5 pt-2">
        <h1 className="text-[32px] font-normal tracking-tight">
          聚餐分帳 <span className="font-mono text-muted">Split</span>
        </h1>
        <div className="relative" ref={menuRef}>
          <button
            aria-label="選單"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 flex-col items-center justify-center gap-[5px]"
          >
            <span className="h-[1.5px] w-6 bg-line" />
            <span className="h-[1.5px] w-6 bg-line" />
            <span className="h-[1.5px] w-6 bg-line" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 z-10 w-40 overflow-hidden rounded-2xl border-[1.5px] border-line bg-background font-mono text-sm">
              <button onClick={copySummary} className="block w-full px-4 py-3 text-left hover:bg-soft">
                複製結果
              </button>
              <button onClick={resetAll} className="block w-full border-t border-soft px-4 py-3 text-left hover:bg-soft">
                全部重設
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 帳單金額 + 收款進度 */}
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
            onChange={(e) => update({ bill: Math.max(0, Number(e.target.value) || 0) })}
            className="w-[5.5ch] min-w-0 bg-transparent text-[30px] leading-none tracking-tight outline-none placeholder:text-muted"
            aria-label="帳單金額"
          />
        </label>
        <RoundButton label="增加 100" onClick={() => update({ bill: state.bill + 100 })}>
          +
        </RoundButton>
        <p className="min-w-0 flex-1 text-[11px] leading-tight text-muted">
          {calc.remaining > 0
            ? `還有 ${state.people.length - calc.paidCount} 人未付款…`
            : state.people.length > 0
              ? "全部收齊，辛苦了！"
              : "新增朋友開始分帳"}
        </p>
        <ProgressRing value={calc.progress} />
      </section>

      {/* 兩張資訊卡 */}
      <section className="mt-3 grid grid-cols-2 gap-3">
        <Card title="PEOPLE" sub={`${state.people.length} 人`}>
          <div className="flex gap-3">
            <div className="flex h-[92px] flex-1 items-end gap-[3px] overflow-hidden">
              {state.people.length === 0 && <span className="text-[11px] text-muted">—</span>}
              {state.people.map((p) => (
                <button
                  key={p.id}
                  title={p.name}
                  onClick={() => updatePerson(p.id, { paid: !p.paid })}
                  className={`w-[9px] shrink-0 rounded-full border-[1.5px] border-line transition-colors ${p.paid ? "bg-line" : ""}`}
                  style={{ height: `${Math.min(100, 55 + p.weight * 30)}%` }}
                />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Stat label="每份" value={money(calc.perUnit, decimals)} />
              <Stat label="已收" value={money(calc.collected, decimals)} />
            </div>
          </div>
          <OnOff
            label="服務費"
            on={state.serviceOn}
            onChange={(v) => update({ serviceOn: v })}
            extra={
              <span className="flex items-baseline">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={state.serviceRate}
                  onChange={(e) => update({ serviceRate: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                  className="w-[2.5ch] bg-transparent text-right outline-none"
                  aria-label="服務費百分比"
                />
                %
              </span>
            }
          />
        </Card>

        <Card title="TOTAL" sub="含服務費">
          <Stat label="總計" value={money(calc.total, state.roundOn && Number.isInteger(calc.total) ? 0 : 2)} big />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Stat label="服務費" value={`+${money(calc.service, 0)}`} />
            <Stat label="未收" value={money(calc.remaining, decimals)} />
          </div>
          <OnOff
            label="無條件進位"
            on={state.roundOn}
            onChange={(v) => update({ roundOn: v })}
            extra={calc.extra > 0.004 ? <span className="text-muted">+{money(calc.extra, 0)}</span> : null}
          />
        </Card>
      </section>

      {/* 人員列表 */}
      <section className="mt-5">
        <div className="flex items-center justify-between pb-2 font-mono text-[11px] tracking-wider">
          <button onClick={addPerson} className="font-medium hover:underline">
            +ADD 新增朋友
          </button>
          <span className="text-muted">份數 ・ 應付 ・ 已付</span>
        </div>
        <ul className="border-t-[1.5px] border-line">
          {state.people.map((p, i) => (
            <li
              key={p.id}
              className={`group flex items-center gap-2 border-b border-soft py-2.5 font-mono text-[13px] ${p.paid ? "text-muted" : "font-semibold"}`}
            >
              <button
                onClick={() => removePerson(p.id)}
                aria-label={`移除 ${p.name}`}
                className="w-4 shrink-0 text-muted opacity-40 hover:opacity-100"
              >
                ×
              </button>
              <input
                value={p.name}
                onChange={(e) => updatePerson(p.id, { name: e.target.value })}
                className="min-w-0 flex-1 bg-transparent uppercase outline-none"
                aria-label="名字"
              />
              <div className="flex shrink-0 items-center font-normal">
                <button
                  aria-label="減少份數"
                  onClick={() => updatePerson(p.id, { weight: Math.max(0.5, p.weight - 0.5) })}
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
              <span className="w-[8ch] shrink-0 text-right">${money(calc.shares[i], decimals)}</span>
              <Toggle on={p.paid} onChange={(v) => updatePerson(p.id, { paid: v })} label={`${p.name} 已付`} />
            </li>
          ))}
          {state.people.length === 0 && (
            <li className="py-6 text-center font-mono text-[12px] text-muted">還沒有人，按 +ADD 新增</li>
          )}
        </ul>
      </section>

      <p className="mt-6 text-center font-mono text-[10px] tracking-widest text-muted">
        資料只存在這台裝置的瀏覽器
      </p>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border-[1.5px] border-line bg-background px-5 py-2 font-mono text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}

function RoundButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line text-lg leading-none active:bg-soft"
    >
      {children}
    </button>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-12 w-12 shrink-0" aria-label={`已收 ${value}%`}>
      <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--soft)" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px]">{value}%</span>
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border-[1.5px] border-line p-3">
      <div className="mb-2 font-mono leading-tight">
        <div className="text-[11px] font-semibold tracking-wider">{title}</div>
        <div className="text-[10px] text-muted">{sub}</div>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="font-mono leading-tight">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={big ? "text-[26px] tracking-tight" : "text-[15px]"}>{value}</div>
    </div>
  );
}

function OnOff({
  label,
  on,
  onChange,
  extra,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mt-auto pt-3 font-mono leading-tight">
      <div className="flex items-center justify-between text-[10px] tracking-wider text-muted">
        <span>{label}</span>
        <span className="text-[11px] text-foreground">{extra}</span>
      </div>
      <div className="text-[18px]">
        <button onClick={() => onChange(true)} className={on ? "" : "text-soft"}>
          ON
        </button>{" "}
        <button onClick={() => onChange(false)} className={on ? "text-soft" : ""}>
          OFF
        </button>
      </div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full border-[1.5px] border-line transition-colors ${on ? "bg-soft" : ""}`}
    >
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-normal text-foreground">
        {on ? "ON" : ""}
      </span>
      <span
        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-line transition-all ${on ? "left-[22px]" : "left-[2px]"}`}
      />
    </button>
  );
}
