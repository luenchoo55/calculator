"use client";

// 聚餐、出遊兩種模式共用的介面元件與小工具

import { useEffect, useRef, useState } from "react";

export const newId = () => Math.random().toString(36).slice(2, 9);

export const toNumber = (raw: string) => Math.max(0, Number(raw) || 0);

export const chipClass = (active: boolean, size: "md" | "sm" = "md") =>
  `shrink-0 rounded-full border-[1.5px] border-line font-mono ${
    size === "md" ? "h-8 px-3 text-[13px]" : "h-6 px-2 text-[11px]"
  } ${active ? "animate-pop bg-line text-background" : "hover:bg-soft"}`;

/** 存在 localStorage 的 state；第一次 render 先用預設值，避免 hydration 不一致 */
export function useStoredState<T extends object>(key: string, fallback: T) {
  const [state, setState] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState({ ...fallback, ...JSON.parse(raw) });
    } catch {}
    setLoaded(true);
    // 只在第一次載入時讀取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state, loaded]);

  return [state, setState] as const;
}

/** 手機上用系統分享（可直接傳 LINE），不支援時改為複製 */
export async function shareText(text: string, toast: (msg: string) => void) {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast("已複製分帳結果");
  } catch (e) {
    if ((e as Error).name !== "AbortError") toast("分享失敗");
  }
}

export function useToast() {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = (text: string) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text });
    timer.current = setTimeout(() => setToast(null), 1800);
  };
  const node = toast ? (
    <div
      key={toast.id}
      className="animate-toast fixed bottom-6 left-1/2 z-20 rounded-full border-[1.5px] border-line bg-background px-5 py-2 font-mono text-sm shadow-[0_4px_0_var(--line)]"
    >
      {toast.text}
    </div>
  ) : null;
  return [node, show] as const;
}

export function Header({
  title,
  sub,
  menu,
  center,
}: {
  title: string;
  sub: string;
  center?: React.ReactNode; // 寬螢幕時放在標題和選單中間
  menu: { label: string; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 點選單外面就關閉
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <header className="flex items-center justify-between pb-3 pt-2">
      <h1 className="text-[32px] font-normal tracking-tight">
        {title} <span className="font-mono text-muted">{sub}</span>
      </h1>
      {center && <div className="mx-8 hidden w-full max-w-md lg:block [&>*]:mb-0">{center}</div>}
      <div className="relative" ref={ref}>
        <button
          aria-label="選單"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-full hover:bg-soft"
        >
          <span className={`h-[1.5px] w-6 bg-line transition-transform duration-200 ${open ? "translate-y-[6.5px] rotate-45" : ""}`} />
          <span className={`h-[1.5px] w-6 bg-line transition-opacity duration-200 ${open ? "opacity-0" : ""}`} />
          <span className={`h-[1.5px] w-6 bg-line transition-transform duration-200 ${open ? "-translate-y-[6.5px] -rotate-45" : ""}`} />
        </button>
        {open && (
          <div className="animate-menu absolute right-0 top-11 z-10 w-40 overflow-hidden rounded-2xl border-[1.5px] border-line bg-background font-mono text-sm shadow-[0_4px_0_var(--line)]">
            {menu.map((m, i) => (
              <button
                key={m.label}
                onClick={() => {
                  m.onClick();
                  setOpen(false);
                }}
                data-press="soft"
                className={`block w-full px-4 py-3 text-left hover:bg-soft ${i > 0 ? "border-t border-soft" : ""}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

export function Panel({
  title,
  sub,
  right,
  children,
}: {
  title: string;
  sub: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-3 rounded-2xl border-[1.5px] border-line p-3">
      <div className="mb-2 flex items-center justify-between font-mono leading-tight">
        <div>
          <div className="text-[11px] font-semibold tracking-wider">{title}</div>
          <div className="text-[10px] text-muted">{sub}</div>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Notice({ warning, note }: { warning?: string | null; note?: string | null }) {
  if (!warning && !note) return null;
  return (
    <div className="mt-2 space-y-1 font-mono text-[11px] leading-snug">
      {warning && <p className="rounded-lg border border-line px-2 py-1">⚠ {warning}</p>}
      {note && <p className="text-muted">{note}</p>}
    </div>
  );
}

export function RoundButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line text-lg leading-none hover:bg-line hover:text-background"
    >
      {children}
    </button>
  );
}

export function ProgressRing({ value }: { value: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-12 w-12 shrink-0" aria-label={`已還 ${value}%`}>
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

export function Card({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
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

export function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="font-mono leading-tight">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={big ? "text-[26px] tracking-tight" : "text-[15px]"}>
        <span key={value} className="animate-num">
          {value}
        </span>
      </div>
    </div>
  );
}

export function OnOff({
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
        <button onClick={() => onChange(true)} className={on ? "animate-pop" : "text-soft hover:text-muted"}>
          ON
        </button>{" "}
        <button onClick={() => onChange(false)} className={on ? "text-soft hover:text-muted" : "animate-pop"}>
          OFF
        </button>
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => {
        navigator.vibrate?.(10);
        onChange(!on);
      }}
      className={`group relative h-6 w-11 shrink-0 rounded-full border-[1.5px] border-line ${on ? "bg-soft" : "hover:bg-soft/50"}`}
    >
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-normal text-foreground">
        {on ? "ON" : ""}
      </span>
      <span
        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-line transition-[left,width] duration-300 ease-[cubic-bezier(0.3,0.7,0.4,1.4)] group-active:w-5 ${on ? "left-[22px] group-active:left-[18px]" : "left-[2px]"}`}
      />
    </button>
  );
}

/** 結算清單：誰要轉帳給誰，點一下標記已還 */
export function SettleList({
  transfers,
  nameOf,
  isPaid,
  onToggle,
  payInfoOf,
  decimals = 0,
  symbol = "$",
}: {
  transfers: { fromId: string; toId: string; amount: number }[];
  nameOf: (id: string) => string;
  payInfoOf?: (id: string) => string | undefined;
  symbol?: string;
  isPaid: (id: string) => boolean;
  onToggle: (id: string) => void;
  decimals?: number;
}) {
  return (
    <Panel title="SETTLE" sub="怎麼還錢" right={<span className="font-mono text-[11px] text-muted">{transfers.length} 筆</span>}>
      {transfers.length === 0 && <p className="font-mono text-[12px] text-muted">不需要轉帳</p>}
      <ul>
        {transfers.map((t) => {
          const paid = isPaid(t.fromId);
          return (
            <li key={`${t.fromId}-${t.toId}`}>
              <button
                onClick={() => {
                  navigator.vibrate?.(10);
                  onToggle(t.fromId);
                }}
                data-press="soft"
                className={`flex w-full items-center gap-2 rounded-lg border-b border-soft px-1 py-2 text-left font-mono text-[13px] hover:bg-soft/60 ${
                  paid ? "text-muted line-through" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {nameOf(t.fromId)} <span className="text-muted">→</span> {nameOf(t.toId)}
                  </span>
                  {payInfoOf?.(t.toId) && (
                    <span className="block truncate text-[10px] text-muted no-underline">{payInfoOf(t.toId)}</span>
                  )}
                </span>
                <span>
                  {symbol}
                  {t.amount.toLocaleString("zh-TW", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
                </span>
                <span className="w-4 text-center">{paid && <span className="animate-check">✓</span>}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** 聚餐／出遊切換 */
export function ModeTabs({ mode, onChange }: { mode: "meal" | "trip"; onChange: (m: "meal" | "trip") => void }) {
  return (
    <div className="relative mb-4 grid grid-cols-2 rounded-full border-[1.5px] border-line p-1 font-mono text-[13px]">
      <span
        aria-hidden
        className={`absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-full bg-line transition-transform duration-300 ease-[cubic-bezier(0.3,0.7,0.4,1.2)] ${
          mode === "trip" ? "translate-x-full" : ""
        }`}
      />
      {(
        [
          ["meal", "聚餐 MEAL"],
          ["trip", "出遊 TRIP"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          data-press="soft"
          className={`relative rounded-full py-1.5 ${mode === id ? "text-background" : "hover:text-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** 收款方式：只列出需要收錢的人 */
export function PayInfoPanel({
  receivers,
  onChange,
}: {
  receivers: { id: string; name: string; payInfo?: string }[];
  onChange: (id: string, payInfo: string) => void;
}) {
  if (receivers.length === 0) return null;
  return (
    <Panel title="PAYMENT" sub="收款方式（會顯示在結算清單）">
      {receivers.map((r) => (
        <label key={r.id} className="flex items-center gap-2 border-b border-soft py-1.5 font-mono text-[13px] last:border-0">
          <span className="w-[5em] shrink-0 truncate">{r.name || "?"}</span>
          <input
            value={r.payInfo ?? ""}
            placeholder="LINE Pay／街口／銀行 帳號"
            onChange={(e) => onChange(r.id, e.target.value)}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
            aria-label={`${r.name} 收款方式`}
          />
        </label>
      ))}
    </Panel>
  );
}
