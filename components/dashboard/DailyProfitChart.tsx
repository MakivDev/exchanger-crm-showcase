"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DatePicker, DateRangePicker } from "@/components/ui/DatePicker";
import { formatDate, formatMoney, formatUsdParts } from "@/lib/format";

function UsdInline({
  value,
  signed,
}: {
  value: number;
  signed?: boolean;
}) {
  const { sign, dollars, cents } = formatUsdParts(value, { signed });
  return (
    <span className="inline-flex items-baseline tabular-nums">
      <span>
        {sign}$&nbsp;{dollars}
      </span>
      <span className="text-[0.85em] text-text-muted">,{cents}</span>
    </span>
  );
}

function toISOLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayLocal() {
  return toISOLocal(new Date());
}

function dashboardPresets() {
  const today = todayLocal();
  const now = new Date();
  const monthStart = toISOLocal(new Date(now.getFullYear(), now.getMonth(), 1));
  const m3 = new Date(now);
  m3.setMonth(m3.getMonth() - 3);
  const m6 = new Date(now);
  m6.setMonth(m6.getMonth() - 6);
  const yearStart = toISOLocal(new Date(now.getFullYear(), 0, 1));
  return [
    { id: "month" as const, label: "Місяць", from: monthStart, to: today },
    { id: "3m" as const, label: "3 міс.", from: toISOLocal(m3), to: today },
    { id: "6m" as const, label: "6 міс.", from: toISOLocal(m6), to: today },
    { id: "year" as const, label: "Рік", from: yearStart, to: today },
  ];
}

export type DailyProfitPoint = {
  date: string;
  profitUsd: number | null;
  source: "closed" | "trade" | "empty";
};

export function DailyProfitChart({
  series,
  dateFrom,
  dateTo,
  isRange,
}: {
  series: DailyProfitPoint[];
  dateFrom: string;
  dateTo: string;
  isRange: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"day" | "range">(isRange ? "range" : "day");
  const presets = useMemo(() => dashboardPresets(), []);

  useEffect(() => {
    setMode(isRange ? "range" : "day");
  }, [isRange]);

  function goDay(iso: string) {
    router.push(`/work/dashboard?date=${iso}`);
  }

  function goRange(from: string, to: string) {
    const a = from <= to ? from : to;
    const b = from <= to ? to : from;
    router.push(`/work/dashboard?from=${a}&to=${b}`);
  }

  const activePreset =
    presets.find((p) => p.from === dateFrom && p.to === dateTo)?.id ?? null;

  const values = series
    .map((s) => s.profitUsd)
    .filter((v): v is number => v != null);
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
  const totalClosed = series
    .filter((s) => s.source === "closed" && s.profitUsd != null)
    .reduce((a, s) => a + (s.profitUsd ?? 0), 0);
  const daysPlus = series.filter(
    (s) => s.profitUsd != null && s.profitUsd > 0,
  ).length;
  const daysMinus = series.filter(
    (s) => s.profitUsd != null && s.profitUsd < 0,
  ).length;

  const chartH = 160;
  const n = series.length;
  const labelH = n > 62 ? 22 : 20;
  const labelStep = n <= 14 ? 1 : n <= 31 ? 2 : n <= 45 ? 3 : 5;
  const MONTHS_UK = [
    "січ",
    "лют",
    "бер",
    "кві",
    "тра",
    "чер",
    "лип",
    "сер",
    "вер",
    "жов",
    "лис",
    "гру",
  ];

  function showAxisLabel(index: number, iso: string) {
    if (n <= 14) return true;
    if (index === 0 || index === n - 1) return true;
    // 3+ months / year: only 1st of each month
    if (n > 62) return iso.endsWith("-01");
    return index % labelStep === 0;
  }

  function axisLabel(iso: string) {
    if (n > 62) {
      const monthIdx = Number(iso.slice(5, 7)) - 1;
      if (iso.endsWith("-01") && monthIdx >= 0 && monthIdx < 12) {
        return MONTHS_UK[monthIdx]!;
      }
      return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
    }
    return iso.slice(8, 10);
  }

  const rangeLabel = isRange
    ? `${formatDate(dateFrom)} – ${formatDate(dateTo)}`
    : formatDate(dateFrom);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">Дашборд</h2>
            <p className="text-sm text-text-muted">
              Дохід по днях · {rangeLabel}. Закриті дні — факт з підсумку;
              інакше — P/L угод журналу.
            </p>
          </div>
          <Link
            href="/work/day-summary"
            className="ui-btn ui-btn-secondary h-8 shrink-0 self-start"
          >
            Підсумок дня
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-[var(--radius)] border border-border p-0.5">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`h-7 rounded-[calc(var(--radius)-2px)] px-2.5 text-[12px] transition ${
                  activePreset === p.id
                    ? "bg-accent text-accent-fg"
                    : "text-text-muted hover:text-text"
                }`}
                onClick={() => {
                  setMode("range");
                  goRange(p.from, p.to);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex rounded-[var(--radius)] border border-border p-0.5">
            <button
              type="button"
              className={`h-7 rounded-[calc(var(--radius)-2px)] px-2.5 text-[12px] transition ${
                mode === "day" && !activePreset
                  ? "bg-accent text-accent-fg"
                  : "text-text-muted hover:text-text"
              }`}
              onClick={() => {
                setMode("day");
                if (isRange) goDay(dateTo);
              }}
            >
              День
            </button>
            <button
              type="button"
              className={`h-7 rounded-[calc(var(--radius)-2px)] px-2.5 text-[12px] transition ${
                mode === "range" && !activePreset
                  ? "bg-accent text-accent-fg"
                  : "text-text-muted hover:text-text"
              }`}
              onClick={() => setMode("range")}
            >
              Календар
            </button>
          </div>
          {mode === "day" ? (
            <DatePicker value={dateFrom} onChange={goDay} />
          ) : (
            <DateRangePicker
              from={dateFrom}
              to={dateTo}
              onChange={({ from, to }) => goRange(from, to)}
            />
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="ui-panel p-3">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">
            Σ закритих днів
          </div>
          <div
            className={`mt-1 font-mono-num text-[18px] font-semibold ${
              totalClosed >= 0 ? "text-success" : "text-danger"
            }`}
          >
            {<UsdInline value={totalClosed} signed />}
          </div>
        </div>
        <div className="ui-panel p-3">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">
            Дні в плюс
          </div>
          <div className="mt-1 font-mono-num text-[18px] font-semibold text-success">
            {daysPlus}
          </div>
        </div>
        <div className="ui-panel p-3">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">
            Дні в мінус
          </div>
          <div className="mt-1 font-mono-num text-[18px] font-semibold text-danger">
            {daysMinus}
          </div>
        </div>
      </div>

      <div className="ui-panel p-4">
        <div
          className={`relative flex items-end border-b border-border pb-0 ${
            n > 62 ? "gap-px" : n > 31 ? "gap-0.5" : "gap-1"
          }`}
          style={{ height: chartH + labelH }}
        >
          <div
            className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-border"
            style={{ bottom: chartH / 2 + labelH }}
          />
          {series.map((s, index) => {
            const v = s.profitUsd;
            const ratio = v == null ? 0 : Math.abs(v) / maxAbs;
            const barH = Math.max(v == null ? 0 : 2, ratio * (chartH / 2 - 4));
            const positive = v != null && v >= 0;
            const labeled = showAxisLabel(index, s.date);
            return (
              <Link
                key={s.date}
                href={`/work/day-summary?date=${s.date}`}
                className="group relative flex min-w-0 flex-1 flex-col items-center justify-end"
                style={{ height: chartH + labelH }}
                title={
                  v == null
                    ? `${s.date}: немає даних`
                    : (() => {
                        const p = formatUsdParts(v, { signed: true });
                        return `${s.date}: ${p.sign}$ ${p.dollars},${p.cents} (${
                          s.source === "closed" ? "підсумок" : "угоди"
                        })`;
                      })()
                }
              >
                <div
                  className="absolute flex w-full flex-col items-center"
                  style={{
                    bottom: positive ? chartH / 2 + labelH : undefined,
                    top: positive ? undefined : chartH / 2 + labelH,
                    height: chartH / 2,
                    justifyContent: positive ? "flex-end" : "flex-start",
                  }}
                >
                  {v != null ? (
                    <div
                      className={`w-full rounded-sm transition group-hover:opacity-80 ${
                        n > 90 ? "max-w-none" : "max-w-[18px]"
                      } ${
                        s.source === "closed"
                          ? positive
                            ? "bg-success"
                            : "bg-danger"
                          : positive
                            ? "bg-success/40"
                            : "bg-danger/40"
                      }`}
                      style={{ height: barH }}
                    />
                  ) : (
                    <div
                      className={`h-0.5 w-full bg-border ${
                        n > 90 ? "max-w-none" : "max-w-[18px]"
                      }`}
                    />
                  )}
                </div>
                {labeled ? (
                  <span
                    className={`absolute bottom-0 whitespace-nowrap text-center leading-none text-text-muted ${
                      n > 62 ? "text-[10px] font-medium" : "text-[9px]"
                    }`}
                  >
                    {axisLabel(s.date)}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-success" />
            Закритий підсумок (+)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-danger" />
            Закритий підсумок (−)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-success/40" />
            Лише P/L угод (орієнтир)
          </span>
        </div>
      </div>

      <div className="ui-panel overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Джерело</th>
                <th className="text-right">Дохід USD</th>
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map((s) => (
                <tr key={s.date}>
                  <td>
                    <Link
                      href={`/work/day-summary?date=${s.date}`}
                      className="hover:text-accent"
                    >
                      {s.date}
                    </Link>
                  </td>
                  <td className="text-[12px] text-text-muted">
                    {s.source === "closed"
                      ? "підсумок дня"
                      : s.source === "trade"
                        ? "угоди журналу"
                        : "—"}
                  </td>
                  <td
                    className={`text-right font-mono-num ${
                      s.profitUsd == null
                        ? "text-text-muted"
                        : s.profitUsd >= 0
                          ? "text-success"
                          : "text-danger"
                    }`}
                  >
                    {s.profitUsd == null ? (
                      "—"
                    ) : (
                      <UsdInline value={s.profitUsd} signed />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[12px] text-text-muted">
        Макс. |дохід| на графіку: ${formatMoney(maxAbs, 4)}
      </p>
    </div>
  );
}
