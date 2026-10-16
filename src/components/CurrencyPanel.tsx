"use client";

import { Panel, chipClass, toNumber } from "@/components/ui";
import { money } from "@/lib/split";
import { CURRENCY_INFO, currencyInfo, formatRate, marketRate, type Currency, type LiveRates } from "@/lib/trip";

// 和市場匯率差超過這個比例就提醒，通常是方向填反或少打一個 0
const WARN_RATIO = 0.15;

function SymbolBadge({ code }: { code: string }) {
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-[1.5px] border-line px-1 text-[10px] font-semibold leading-none">
      {currencyInfo(code).symbol}
    </span>
  );
}

export default function CurrencyPanel({
  base,
  currencies,
  live,
  loading,
  onBase,
  onRefresh,
  onAdd,
  onRate,
  onRemove,
}: {
  base: string;
  currencies: Currency[];
  live: LiveRates;
  loading: boolean;
  onBase: (code: string) => void;
  onRefresh: () => void;
  onAdd: (c: Currency) => void;
  onRate: (code: string, rate: number) => void;
  onRemove: (code: string) => void;
}) {
  const baseInfo = currencyInfo(base);
  const updated = live.updated
    ? new Date(live.updated).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <Panel
      title="CURRENCY"
      sub={updated ? `即時匯率・${updated} 更新` : "出國記帳用，結算時統一換算"}
      right={
        <button onClick={onRefresh} disabled={loading} className={`${chipClass(false, "sm")} disabled:opacity-50`}>
          <span className={`inline-block ${loading ? "animate-spin" : ""}`}>↻</span> 更新匯率
        </button>
      }
    >
      {/* 結算幣別：大家最後用哪種錢互相轉帳 */}
      <label className="flex items-center gap-2 rounded-xl border-[1.5px] border-line px-3 py-2 font-mono text-[13px]">
        <SymbolBadge code={base} />
        <span className="flex-1">
          結算幣別
          <span className="block text-[10px] text-muted">轉帳金額都用這個幣別顯示</span>
        </span>
        <select
          value={base}
          onChange={(e) => onBase(e.target.value)}
          className="rounded-full border-[1.5px] border-line bg-background px-2 py-1 text-[13px] outline-none hover:bg-soft"
          aria-label="結算幣別"
        >
          {CURRENCY_INFO.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} {c.code}
            </option>
          ))}
        </select>
      </label>

      {currencies.map((c) => {
        const info = currencyInfo(c.code);
        const market = marketRate(c.code, base, live);
        const off = live.updated ? Math.abs(c.rate / market - 1) > WARN_RATIO : false;
        return (
          <div key={c.code} className="border-b border-soft py-2.5 font-mono last:border-0">
            <div className="flex items-center gap-2 text-[13px]">
              <SymbolBadge code={c.code} />
              <span className="font-semibold">{info.name}</span>
              <span className="text-[11px] text-muted">{c.code}</span>
              <button
                onClick={() => onRemove(c.code)}
                aria-label={`移除 ${info.name}`}
                className="ml-auto w-4 text-muted opacity-40 hover:rotate-90 hover:opacity-100"
              >
                ×
              </button>
            </div>

            {/* 用「1 日圓 = ? 台幣」的說法，跟銀行牌告一樣 */}
            <label className="mt-1.5 flex items-center gap-1.5 text-[13px]">
              <span className="text-muted">1 {info.name} =</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={c.rate || ""}
                onChange={(e) => onRate(c.code, toNumber(e.target.value))}
                className={`w-[9ch] rounded-full border px-2 py-0.5 text-right outline-none ${off ? "border-line bg-soft" : "border-soft"}`}
                aria-label={`${info.name} 匯率`}
              />
              <span className="text-muted">{baseInfo.name}</span>
            </label>

            <div className="mt-1 text-[11px] text-muted">
              {money(info.sample)} {info.name} ≈{" "}
              <span className="text-foreground">
                {baseInfo.symbol}
                {money(info.sample * c.rate, info.sample * c.rate < 10 ? 2 : 0)}
              </span>
            </div>

            {off && (
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-line px-2 py-1 text-[11px]">
                <span className="min-w-0 flex-1">⚠ 跟市場匯率 {formatRate(market)} 差很多，可能填反了</span>
                <button className={chipClass(false, "sm")} onClick={() => onRate(c.code, Number(formatRate(market)))}>
                  套用
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {CURRENCY_INFO.filter((info) => info.code !== base && !currencies.some((c) => c.code === info.code)).map(
          (info) => (
            <button
              key={info.code}
              className={chipClass(false, "sm")}
              onClick={() => onAdd({ code: info.code, rate: Number(formatRate(marketRate(info.code, base, live))) })}
            >
              + {info.symbol} {info.name}
            </button>
          ),
        )}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-muted">
        加入外幣後，點支出旁的幣別切換。刷卡的話可以直接填「實付」金額，最準確
      </p>
    </Panel>
  );
}
