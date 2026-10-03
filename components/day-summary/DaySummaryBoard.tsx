"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CaretLeft, CaretRight, Info } from "@phosphor-icons/react";
import {
  closeDaySummaryAction,
  reopenDaySummaryAction,
  saveDayRatesAction,
} from "@/lib/actions/day-summary";
import type { DaySummaryData } from "@/lib/data/day-summary";
import { formatMoney, formatSignedMoney, formatUsdParts } from "@/lib/format";
import { RATE_HINT } from "@/lib/types/domain";

const DAY_RATES_TOOLTIP =
  "Не курси купівлі чи продажу з операцій. Один орієнтовний курс на валюту за день — лише для звірки підсумку: перевести залишки й рухи в USD і порівняти теорію з фактом. На каси, журнал і історію не впливає.";

const MOVES_PREVIEW = 8;

function InfoTip({
  text,
  ariaLabel,
  size = 12,
}: {
  text: string;
  ariaLabel: string;
  size?: number;
}) {
  const tipId = useId();
  const btnRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placeAbove: false });

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;

    function place() {
      const btn = btnRef.current!.getBoundingClientRect();
      const tip = tipRef.current?.getBoundingClientRect();
      const tipW = tip?.width ?? 288;
      const tipH = tip?.height ?? 96;
      const pad = 8;
      let left = btn.left;
      if (left + tipW > window.innerWidth - pad) {
        left = window.innerWidth - tipW - pad;
      }
      if (left < pad) left = pad;

      const spaceBelow = window.innerHeight - btn.bottom - pad;
      const placeAbove = spaceBelow < tipH + 8 && btn.top > tipH + 8;
      const top = placeAbove ? btn.top - tipH - 6 : btn.bottom + 6;
      setCoords({ top, left, placeAbove });
    }

    place();
    // Remeasure after paint when tip size is known
    const raf = requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, text]);

  return (
    <>
      <span
        ref={btnRef}
        role="button"
        tabIndex={0}
        className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full text-text-muted transition hover:bg-surface-2 hover:text-accent"
        aria-label={ariaLabel}
        aria-describedby={open ? tipId : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <Info size={size} weight="fill" />
      </span>
      {mounted &&
        open &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            className="pointer-events-none fixed z-[200] w-72 max-w-[calc(100vw-1rem)] rounded-[var(--radius)] border border-border bg-surface px-2.5 py-2 text-[12px] leading-snug text-text shadow-lg"
            style={{ top: coords.top, left: coords.left }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}

export function DaySummaryBoard({
  data,
  canEdit,
}: {
  data: DaySummaryData;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(data.closed?.note ?? "");

  const [rateDraft, setRateDraft] = useState(() =>
    Object.fromEntries(
      data.rates.map((r) => [r.currencyId, String(r.unitsPerUsd)]),
    ),
  );
  const [openKpis, setOpenKpis] = useState<Record<string, boolean>>({});
  const [movesExpanded, setMovesExpanded] = useState(false);

  useEffect(() => {
    setRateDraft(
      Object.fromEntries(
        data.rates.map((r) => [r.currencyId, String(r.unitsPerUsd)]),
      ),
    );
    setNote(data.closed?.note ?? "");
    setError(null);
    setOpenKpis({});
    setMovesExpanded(false);
  }, [data.date]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only on date change

  function toggleKpi(id: string) {
    setOpenKpis((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const calc = data.closed
    ? {
        openingUsd: data.closed.openingUsd,
        movementsUsd: data.closed.movementsUsd,
        theoreticalClosingUsd: data.closed.theoreticalClosingUsd,
        actualClosingUsd: data.closed.actualClosingUsd,
        profitUsd: data.closed.profitUsd,
        missingRateCodes: [] as string[],
        openingFromPrevClose: data.calc.openingFromPrevClose,
        movementRows: data.calc.movementRows,
        openingRows: data.calc.openingRows,
        closingRows: data.calc.closingRows,
      }
    : data.calc;

  const closed = Boolean(data.closed);

  function go(date: string) {
    router.push(`/work/day-summary?date=${date}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text">Підсумок дня</h2>
          <p className="text-sm text-text-muted">
            Звірка: факт USD − теорія USD = дохід дня · {data.branchName}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="ui-btn ui-btn-secondary h-8 w-8 p-0"
            onClick={() => go(data.prevDate)}
            aria-label="Попередній день"
          >
            <CaretLeft size={16} />
          </button>
          <input
            type="date"
            value={data.date}
            onChange={(e) => go(e.target.value)}
            className="ui-input h-8 w-auto"
          />
          <button
            type="button"
            className="ui-btn ui-btn-secondary h-8 w-8 p-0"
            onClick={() => go(data.nextDate)}
            aria-label="Наступний день"
          >
            <CaretRight size={16} />
          </button>
        </div>
      </div>

      {closed ? (
        <div className="rounded-[var(--radius)] border border-success/40 bg-[color-mix(in_oklab,var(--success)_8%,var(--surface))] px-3 py-2 text-[13px] text-success">
          День закрито
          {data.closed?.by ? ` · ${data.closed.by}` : ""}
          {data.closed?.at
            ? ` · ${new Date(data.closed.at).toLocaleString("uk-UA")}`
            : ""}
        </div>
      ) : null}

      {/* Rates */}
      <section className="ui-panel p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-[14px] font-semibold">Курси дня</h3>
              <InfoTip
                text={DAY_RATES_TOOLTIP}
                ariaLabel="Що таке курси дня"
                size={14}
              />
            </div>
            <p className="text-[12px] text-text-muted">
              Для звірки підсумку в USD · {RATE_HINT}
            </p>
          </div>
          {canEdit && !closed ? (
            <button
              type="button"
              className="ui-btn ui-btn-secondary h-8 text-[12px]"
              disabled={pending}
              onClick={() => {
                start(async () => {
                  setError(null);
                  const res = await saveDayRatesAction({
                    date: data.date,
                    rates: data.rates.map((r) => ({
                      currencyId: r.currencyId,
                      unitsPerUsd: rateDraft[r.currencyId] ?? String(r.unitsPerUsd),
                    })),
                  });
                  if (!res.ok) setError(res.error);
                  else router.refresh();
                });
              }}
            >
              Зберегти курси
            </button>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {data.rates.map((r) => (
            <label key={r.currencyId}>
              <span className="ui-label">{r.currencyCode}</span>
              <input
                value={rateDraft[r.currencyId] ?? ""}
                onChange={(e) =>
                  setRateDraft((prev) => ({
                    ...prev,
                    [r.currencyId]: e.target.value,
                  }))
                }
                className="ui-input font-mono-num"
                disabled={!canEdit || closed}
                inputMode="decimal"
              />
            </label>
          ))}
        </div>
        {calc.missingRateCodes.length > 0 ? (
          <p className="mt-2 text-[12px] font-medium text-danger">
            Не вистачає курсів: {calc.missingRateCodes.join(", ")}
          </p>
        ) : null}
      </section>

      {/* KPI strip — cards expand independently; open ones span full width */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <ExpandableKpi
          open={Boolean(openKpis.opening)}
          onToggle={() => toggleKpi("opening")}
          label="Відкриття USD"
          value={calc.openingUsd}
          tooltip={
            calc.openingFromPrevClose
              ? "USD-еквівалент на початок дня: береться факт (кінець) попереднього закритого дня. Це «стартовий капітал» для теорії."
              : "Немає закриття попереднього дня — відкриття пораховане як сума залишків кас на початок × курси цього дня."
          }
          hint={
            calc.openingFromPrevClose
              ? "з підсумку попереднього дня"
              : "з залишків на початок × курси"
          }
          detail={
            <div className="space-y-2 text-[12px] text-text-muted">
              <p>
                {calc.openingFromPrevClose
                  ? "Джерело: actualClosingUsd попереднього дня."
                  : "Джерело: залишки кас на початок, переведені в USD курсами дня."}
              </p>
              <MiniWalletUsdTable
                rows={calc.openingRows}
                empty="Немає даних залишків"
                showDayRate
              />
            </div>
          }
        />
        <ExpandableKpi
          open={Boolean(openKpis.moves)}
          onToggle={() => toggleKpi("moves")}
          label="Рухи USD"
          value={calc.movementsUsd}
          signed
          tooltip="Σ усіх підписаних рухів дня (журнал, операції, корекції), кожен переведений у USD за курсом дня цієї валюти. + надходження, − видача. Не плутати з курсом угоди в журналі."
          hint="Σ рухів × курси дня"
          detail={
            <div className="space-y-2 text-[12px] text-text-muted">
              <p>
                {movesExpanded || calc.movementRows.length <= MOVES_PREVIEW
                  ? "Усі рухи дня в цьому блоці; повна таблиця також нижче на сторінці."
                  : "Показано перші рухи; повний список — кнопкою нижче або в таблиці «Рухи дня»."}
              </p>
              <MiniMovesTable
                rows={
                  movesExpanded
                    ? calc.movementRows
                    : calc.movementRows.slice(0, MOVES_PREVIEW)
                }
              />
              {calc.movementRows.length > MOVES_PREVIEW ? (
                <button
                  type="button"
                  className="text-[12px] font-medium text-accent hover:underline"
                  onClick={() => setMovesExpanded((v) => !v)}
                >
                  {movesExpanded
                    ? "Згорнути список"
                    : `… ще ${calc.movementRows.length - MOVES_PREVIEW}`}
                </button>
              ) : null}
            </div>
          }
        />
        <ExpandableKpi
          open={Boolean(openKpis.theory)}
          onToggle={() => toggleKpi("theory")}
          label="Теорія (кінець)"
          value={calc.theoreticalClosingUsd}
          tooltip="Очікуваний USD на кінець дня, якщо просто додати до відкриття всі рухи за курсами дня: теорія = відкриття + рухи. Це «як мало б бути» без переоцінки залишків."
          hint="відкриття + рухи"
          detail={
            <div className="space-y-1.5 font-mono-num text-[12px]">
              <div className="flex justify-between gap-3">
                <span className="text-text-muted">Відкриття</span>
                <span>
                  {calc.openingUsd == null ? (
                    "—"
                  ) : (
                    <UsdText value={calc.openingUsd} />
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-muted">+ Рухи</span>
                <span>
                  {calc.movementsUsd == null ? (
                    "—"
                  ) : (
                    <UsdText value={calc.movementsUsd} signed />
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-1.5 font-medium text-text">
                <span>Теорія</span>
                <span>
                  {calc.theoreticalClosingUsd == null ? (
                    "—"
                  ) : (
                    <UsdText value={calc.theoreticalClosingUsd} />
                  )}
                </span>
              </div>
            </div>
          }
        />
        <ExpandableKpi
          open={Boolean(openKpis.actual)}
          onToggle={() => toggleKpi("actual")}
          label="Факт (кінець)"
          value={calc.actualClosingUsd}
          tooltip="Фактичний USD-еквівалент залишків кас на кінець дня: кожна каса × курс дня цієї валюти. Живі залишки, знімок при закритті або відкриття+рухи в нативній валюті — залежно від стану дня."
          hint={
            data.closingSource === "live"
              ? "живі залишки кас"
              : data.closingSource === "closed"
                ? "знімок при закритті"
                : "відкриття + рухи"
          }
          detail={
            <div className="space-y-2 text-[12px] text-text-muted">
              <p>
                Джерело залишків:{" "}
                {data.closingSource === "live"
                  ? "поточні баланси кас"
                  : data.closingSource === "closed"
                    ? "знімок при закритті дня"
                    : "розрахунок відкриття + рухи в валюті каси"}
                . USD — за курсами цього дня.
              </p>
              <MiniWalletUsdTable
                rows={calc.closingRows}
                empty="Немає даних залишків"
                showDayRate
              />
            </div>
          }
        />
        <ExpandableKpi
          open={Boolean(openKpis.profit)}
          onToggle={() => toggleKpi("profit")}
          label="Дохід дня"
          value={calc.profitUsd}
          signed
          emphasize
          tooltip="Дохід = факт − теорія. Якщо факт більший за теорію — у плюс (переоцінка/спред/угоди). Якщо менший — у мінус. Це звірка підсумку дня, не окремий P/L рядка журналу."
          detail={
            <div className="space-y-1.5 font-mono-num text-[12px]">
              <div className="flex justify-between gap-3">
                <span className="text-text-muted">Факт (кінець)</span>
                <span>
                  {calc.actualClosingUsd == null ? (
                    "—"
                  ) : (
                    <UsdText value={calc.actualClosingUsd} />
                  )}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-muted">− Теорія (кінець)</span>
                <span>
                  {calc.theoreticalClosingUsd == null ? (
                    "—"
                  ) : (
                    <UsdText value={calc.theoreticalClosingUsd} />
                  )}
                </span>
              </div>
              <div
                className={`flex justify-between gap-3 border-t border-border pt-1.5 font-semibold ${
                  calc.profitUsd == null
                    ? "text-text-muted"
                    : calc.profitUsd >= 0
                      ? "text-success"
                      : "text-danger"
                }`}
              >
                <span>Дохід дня</span>
                <span>
                  {calc.profitUsd == null ? (
                    "—"
                  ) : (
                    <UsdText value={calc.profitUsd} signed />
                  )}
                </span>
              </div>
            </div>
          }
        />
      </div>

      <p className="text-[12px] text-text-muted">
        Формула:{" "}
        <span className="font-mono-num">дохід = факт − теорія</span>
        {" · "}
        теорія = відкриття + Σ(рухи в USD за курсами дня)
        {data.tradeProfitUsd !== 0 ? (
          <>
            {" · "}
            P/L угод журналу (окремо):{" "}
            <span className="font-mono-num">
              <UsdText value={data.tradeProfitUsd} signed />
            </span>
          </>
        ) : null}
      </p>

      {/* Opening / closing tables */}
      <div className="grid gap-3 lg:grid-cols-2">
        <WalletTable
          title="На початок дня"
          rows={calc.openingRows}
          lastRates={data.lastRates}
        />
        <WalletTable
          title="На кінець дня"
          rows={calc.closingRows}
          lastRates={data.lastRates}
        />
      </div>

      {/* Movements */}
      <section className="ui-panel overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-[14px] font-semibold">
            Рухи дня ({data.movementCount})
          </h3>
          <p className="text-[12px] text-text-muted">
            У USD за курсами цього дня (не курсами угоди)
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Джерело</th>
                <th>Опис</th>
                <th>Каса</th>
                <th className="text-right">Сума</th>
                <th className="text-right">Курс</th>
                <th className="text-right">USD</th>
              </tr>
            </thead>
            <tbody>
              {calc.movementRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-text-muted">
                    Рухів немає
                  </td>
                </tr>
              ) : (
                calc.movementRows.map((m) => (
                  <tr key={m.id}>
                    <td className="text-[12px] text-text-muted">{m.source}</td>
                    <td>{m.label}</td>
                    <td>
                      {m.walletName}{" "}
                      <span className="text-text-muted">{m.currencyCode}</span>
                    </td>
                    <td
                      className={`text-right font-mono-num ${
                        m.amount < 0 ? "text-danger" : "text-success"
                      }`}
                    >
                      {formatSignedMoney(m.amount)}
                    </td>
                    <td className="text-right font-mono-num text-text-muted">
                      {m.rate != null ? formatMoney(m.rate, 6) : "—"}
                    </td>
                    <td
                      className={`text-right font-mono-num ${
                        m.usd == null
                          ? "text-danger"
                          : m.usd < 0
                            ? "text-danger"
                            : "text-success"
                      }`}
                    >
                      {m.usd == null
                        ? "немає курсу"
                        : (
                          <UsdText value={m.usd} signed />
                        )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {error ? <p className="text-[13px] text-danger">{error}</p> : null}

      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          {!closed ? (
            <>
              <label className="min-w-[12rem] flex-1">
                <span className="ui-label">Примітка до закриття</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="ui-input"
                  placeholder="опційно"
                />
              </label>
              <button
                type="button"
                className="ui-btn ui-btn-primary"
                disabled={pending || calc.profitUsd == null}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Закрити день ${data.date}?\nДохід: ${
                        calc.profitUsd != null
                          ? (() => {
                              const p = formatUsdParts(calc.profitUsd, {
                                signed: true,
                              });
                              return `${p.sign}$ ${p.dollars},${p.cents}`;
                            })()
                          : "—"
                      }`,
                    )
                  )
                    return;
                  start(async () => {
                    setError(null);
                    // save rates first
                    await saveDayRatesAction({
                      date: data.date,
                      rates: data.rates.map((r) => ({
                        currencyId: r.currencyId,
                        unitsPerUsd:
                          rateDraft[r.currencyId] ?? String(r.unitsPerUsd),
                      })),
                    });
                    const res = await closeDaySummaryAction({
                      date: data.date,
                      note,
                    });
                    if (!res.ok) setError(res.error);
                    else router.refresh();
                  });
                }}
              >
                Закрити день
              </button>
            </>
          ) : (
            <button
              type="button"
              className="ui-btn ui-btn-secondary"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Відкрити день знову?")) return;
                start(async () => {
                  setError(null);
                  const res = await reopenDaySummaryAction({ date: data.date });
                  if (!res.ok) setError(res.error);
                  else router.refresh();
                });
              }}
            >
              Відкрити день
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function UsdText({
  value,
  signed,
  large,
}: {
  value: number;
  signed?: boolean;
  large?: boolean;
}) {
  const { sign, dollars, cents } = formatUsdParts(value, { signed });
  return (
    <span className="inline-flex items-baseline tabular-nums">
      <span>
        {sign}$&nbsp;{dollars}
      </span>
      <span
        className={`text-text-muted ${large ? "text-[0.72em]" : "text-[0.85em]"}`}
      >
        ,{cents}
      </span>
    </span>
  );
}

function ExpandableKpi({
  open,
  onToggle,
  label,
  value,
  tooltip,
  hint,
  signed,
  emphasize,
  detail,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  value: number | null;
  tooltip: string;
  hint?: string;
  signed?: boolean;
  emphasize?: boolean;
  detail: ReactNode;
}) {
  const color =
    value == null
      ? "text-text-muted"
      : emphasize
        ? value >= 0
          ? "text-success"
          : "text-danger"
        : "text-text";

  return (
    <div
      className={`ui-panel overflow-hidden p-0 ${
        open ? "ring-1 ring-accent/40 sm:col-span-2 lg:col-span-2" : ""
      }`}
    >
      <button
        type="button"
        className="w-full p-3 text-left transition hover:bg-surface-2/60"
        aria-expanded={open}
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1">
            <span className="text-[10px] uppercase tracking-wide text-text-muted">
              {label}
            </span>
            <InfoTip text={tooltip} ariaLabel={label} />
          </div>
          <CaretRight
            size={12}
            className={`mt-0.5 shrink-0 text-text-muted transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
        </div>
        <div
          className={`mt-1.5 font-mono-num font-semibold leading-none ${
            emphasize ? "text-[22px]" : "text-[18px]"
          } ${color}`}
        >
          {value == null ? "—" : <UsdText value={value} signed={signed} large />}
        </div>
        {emphasize && value != null ? (
          <div className="mt-1.5 text-[11px] text-text-muted">
            {value >= 0 ? "у плюс за день" : "у мінус за день"} · клік для
            деталей
          </div>
        ) : hint ? (
          <div className="mt-1 text-[11px] text-text-muted">
            {hint} · клік для деталей
          </div>
        ) : (
          <div className="mt-1 text-[11px] text-text-muted">
            клік для деталей
          </div>
        )}
      </button>
      {open ? (
        <div className="border-t border-border bg-bg/60 px-3 py-3">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function MiniWalletUsdTable({
  rows,
  empty,
  showDayRate,
}: {
  rows: Array<{
    walletId: string;
    walletName: string;
    currencyCode: string;
    amount: number;
    rate: number | null;
    usd: number | null;
  }>;
  empty: string;
  showDayRate?: boolean;
}) {
  if (rows.length === 0) {
    return <p>{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-auto border-separate border-spacing-0 text-left text-[12px]">
        <thead>
          <tr className="text-text-muted">
            <th className="py-1 pr-3 font-medium">Каса</th>
            <th className="whitespace-nowrap py-1 pl-2 pr-3 text-right font-medium">
              Сума
            </th>
            {showDayRate ? (
              <th className="whitespace-nowrap py-1 pl-2 pr-3 text-right font-medium">
                Курс
              </th>
            ) : null}
            <th className="whitespace-nowrap py-1 pl-2 text-right font-medium">
              USD
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.walletId}>
              <td className="border-t border-border/60 py-1 pr-3 text-text">
                <span className="font-medium">{r.walletName}</span>{" "}
                <span className="text-text-muted">{r.currencyCode}</span>
              </td>
              <td className="whitespace-nowrap border-t border-border/60 py-1 pl-2 pr-3 text-right font-mono-num text-text">
                {formatMoney(r.amount)}
              </td>
              {showDayRate ? (
                <td className="whitespace-nowrap border-t border-border/60 py-1 pl-2 pr-3 text-right font-mono-num text-text-muted">
                  {r.rate != null ? formatMoney(r.rate, 4) : "—"}
                </td>
              ) : null}
              <td className="whitespace-nowrap border-t border-border/60 py-1 pl-2 text-right font-mono-num text-text">
                {r.usd == null ? (
                  r.amount === 0 ? (
                    "$0"
                  ) : (
                    "—"
                  )
                ) : (
                  <UsdText value={r.usd} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniMovesTable({
  rows,
}: {
  rows: Array<{
    id: string;
    label: string;
    walletName: string;
    currencyCode: string;
    amount: number;
    usd: number | null;
  }>;
}) {
  if (rows.length === 0) {
    return <p>Рухів немає</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-auto border-separate border-spacing-0 text-left text-[12px]">
        <thead>
          <tr className="text-text-muted">
            <th className="py-1 pr-3 font-medium">Опис</th>
            <th className="whitespace-nowrap py-1 pl-2 pr-3 text-right font-medium">
              Сума
            </th>
            <th className="whitespace-nowrap py-1 pl-2 text-right font-medium">
              USD
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td className="border-t border-border/60 py-1 pr-3 text-text">
                <span className="font-medium">{m.label}</span>
                <span className="text-text-muted">
                  {" "}
                  · {m.walletName}
                </span>
              </td>
              <td
                className={`whitespace-nowrap border-t border-border/60 py-1 pl-2 pr-3 text-right font-mono-num ${
                  m.amount < 0 ? "text-danger" : "text-success"
                }`}
              >
                {formatSignedMoney(m.amount)}{" "}
                <span className="text-text-muted">{m.currencyCode}</span>
              </td>
              <td
                className={`whitespace-nowrap border-t border-border/60 py-1 pl-2 text-right font-mono-num ${
                  m.usd == null
                    ? "text-danger"
                    : m.usd < 0
                      ? "text-danger"
                      : "text-success"
                }`}
              >
                {m.usd == null ? "—" : <UsdText value={m.usd} signed />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WalletTable({
  title,
  rows,
  lastRates,
}: {
  title: string;
  rows: Array<{
    walletId: string;
    walletName: string;
    currencyCode: string;
    amount: number;
    rate: number | null;
    usd: number | null;
  }>;
  lastRates: Record<string, number>;
}) {
  return (
    <section className="ui-panel overflow-hidden p-0">
      <div className="border-b border-border px-3 py-2">
        <div className="text-[13px] font-semibold">{title}</div>
        <p className="text-[11px] text-text-muted">
          ≈USD за останнім курсом каси
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Каса</th>
              <th className="text-right">Сума</th>
              <th className="text-right">Ост. курс</th>
              <th className="text-right">≈USD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const lastRate = lastRates[r.walletId] ?? null;
              const approx =
                lastRate != null && lastRate > 0
                  ? Number((Math.abs(r.amount) / lastRate).toFixed(4))
                  : null;
              return (
                <tr key={r.walletId}>
                  <td>
                    {r.walletName}{" "}
                    <span className="text-text-muted">{r.currencyCode}</span>
                  </td>
                  <td className="text-right font-mono-num">
                    {formatMoney(r.amount)}
                  </td>
                  <td className="text-right font-mono-num text-text-muted">
                    {lastRate != null ? formatMoney(lastRate, 6) : "—"}
                  </td>
                  <td
                    className={`text-right font-mono-num ${
                      approx == null && r.amount !== 0
                        ? "text-danger"
                        : "text-text-muted"
                    }`}
                  >
                    {approx == null
                      ? r.amount === 0
                        ? "$0"
                        : "немає курсу"
                      : `≈$${formatMoney(approx, 4)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
