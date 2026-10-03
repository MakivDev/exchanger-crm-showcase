"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash, X } from "@phosphor-icons/react";
import {
  deleteJournalPositionAction,
  getCounterpartyOpenDebtsAction,
  saveJournalPositionAction,
  type PositionLineInput,
} from "@/lib/actions/journal-position";
import {
  autoProfitUsd,
  fillMissingRates,
  formatCalcSummary,
  type CalcLine,
  type LineSide,
} from "@/lib/money/journal-calc";
import {
  formatDate,
  formatMoney,
  formatSignedMoney,
  parseDecimalInput,
} from "@/lib/format";
import type { JournalDayData } from "@/lib/data/journal-positions";
import { DatePicker, DateRangePicker } from "@/components/ui/DatePicker";

type WalletOpt = JournalDayData["wallets"][number];
type CpOpt = JournalDayData["counterparties"][number];
type PositionView = JournalDayData["positions"][number];

type DraftLine = {
  key: string;
  walletId: string;
  side: LineSide;
  amount: string;
  rateUsd: string;
};

function newKey() {
  return `k-${Math.random().toString(36).slice(2, 9)}`;
}

function suggestedRateForWallet(
  w?: {
    currencyCode?: string;
    lastRateUsd?: number | null;
    lastBuyRateUsd?: number | null;
    lastSellRateUsd?: number | null;
  },
  side?: LineSide,
) {
  if (!w) return "";
  if (w.currencyCode === "USD") return "1";
  const preferred =
    side === "out"
      ? (w.lastSellRateUsd ?? w.lastRateUsd ?? w.lastBuyRateUsd)
      : side === "inn"
        ? (w.lastBuyRateUsd ?? w.lastRateUsd ?? w.lastSellRateUsd)
        : (w.lastRateUsd ?? w.lastBuyRateUsd ?? w.lastSellRateUsd);
  if (preferred != null && preferred > 0) return String(preferred);
  return "";
}

function lineRate(raw: string, currencyCode?: string): number | null {
  const n = parseDecimalInput(raw);
  if (n != null && n > 0) return n;
  if (currencyCode === "USD") return 1;
  return null;
}

function signedInWallet(lines: PositionView["lines"], walletId: string) {
  let sum = 0;
  let hit = false;
  for (const l of lines) {
    if (l.walletId !== walletId) continue;
    hit = true;
    sum += l.side === "out" ? -l.amount : l.amount;
  }
  return hit ? sum : null;
}

function SidePanel({
  title,
  hint,
  tone,
  lines,
  wallets,
  filledLines,
  onAdd,
  onUpdate,
  onRemove,
  usdTotal,
}: {
  title: string;
  hint: string;
  tone: "out" | "inn";
  lines: DraftLine[];
  wallets: WalletOpt[];
  filledLines: CalcLine[];
  onAdd: () => void;
  onUpdate: (key: string, patch: Partial<DraftLine>) => void;
  onRemove: (key: string) => void;
  usdTotal: number | null;
}) {
  const isOut = tone === "out";
  return (
    <div
      className={`flex flex-col rounded-[var(--radius)] border ${
        isOut
          ? "border-[color-mix(in_oklab,var(--danger)_35%,var(--border))] bg-[color-mix(in_oklab,var(--danger)_6%,var(--surface))]"
          : "border-[color-mix(in_oklab,var(--success)_35%,var(--border))] bg-[color-mix(in_oklab,var(--success)_6%,var(--surface))]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div>
          <div
            className={`text-[13px] font-semibold ${isOut ? "text-danger" : "text-success"}`}
          >
            {title}
          </div>
          <div className="text-[11px] text-text-muted">{hint}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-text-muted">
            Σ USD
          </div>
          <div
            className={`font-mono-num text-[13px] font-medium ${isOut ? "text-danger" : "text-success"}`}
          >
            {usdTotal != null ? `$${formatMoney(usdTotal)}` : "—"}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2">
        {lines.length === 0 ? (
          <p className="px-1 py-4 text-center text-[12px] text-text-muted">
            Порожньо
          </p>
        ) : (
          lines.map((l) => {
            const filled = filledLines.find((x) => x.id === l.key);
            const currencyCode = wallets.find(
              (w) => w.id === l.walletId,
            )?.currencyCode;
            const rate = lineRate(l.rateUsd, currencyCode);
            const noRate = rate == null;
            return (
              <div
                key={l.key}
                className="rounded-[var(--radius)] border border-border bg-surface p-2"
              >
                <div className="mb-1.5 flex items-center gap-1">
                  <select
                    value={l.walletId}
                    onChange={(e) =>
                      onUpdate(l.key, { walletId: e.target.value })
                    }
                    className="ui-input min-w-0 flex-1 text-[13px]"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="ui-btn ui-btn-ghost h-8 w-8 shrink-0 p-0"
                    aria-label="Видалити рядок"
                    onClick={() => onRemove(l.key)}
                  >
                    <Trash size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <label>
                    <span className="ui-label">Сума</span>
                    <input
                      value={l.amount}
                      onChange={(e) =>
                        onUpdate(l.key, { amount: e.target.value })
                      }
                      className="ui-input font-mono-num"
                      inputMode="decimal"
                      required
                    />
                  </label>
                  <label>
                    <span className="ui-label">
                      Курс → USD ({isOut ? "продаж" : "купівля"})
                    </span>
                    <input
                      value={l.rateUsd}
                      onChange={(e) =>
                        onUpdate(l.key, { rateUsd: e.target.value })
                      }
                      className={`ui-input font-mono-num ${noRate && l.amount ? "border-danger" : ""}`}
                      inputMode="decimal"
                      placeholder={
                        suggestedRateForWallet(
                          wallets.find((w) => w.id === l.walletId),
                          l.side,
                        ) || "опц."
                      }
                    />
                  </label>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">в USD</span>
                  <span
                    className={`font-mono-num font-medium ${
                      filled?.usdAmount != null && rate != null
                        ? isOut
                          ? "text-danger"
                          : "text-success"
                        : "text-text-muted"
                    }`}
                  >
                    {filled?.usdAmount != null && rate != null
                      ? `$${formatMoney(filled.usdAmount)} · курс ${formatMoney(rate, 6)}`
                      : "немає курсу"}
                  </span>
                </div>
              </div>
            );
          })
        )}

        <button
          type="button"
          className={`ui-btn h-8 w-full text-[12px] ${isOut ? "ui-btn-secondary" : "ui-btn-secondary"}`}
          onClick={onAdd}
        >
          <Plus size={12} /> Додати
        </button>
      </div>
    </div>
  );
}

function PositionEditModal({
  open,
  onClose,
  wallets,
  counterparties,
  date,
  initial,
  canEdit,
}: {
  open: boolean;
  onClose: () => void;
  wallets: WalletOpt[];
  counterparties: CpOpt[];
  date: string;
  initial?: PositionView | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const [operationDate, setOperationDate] = useState(date);
  const [counterpartyId, setCounterpartyId] = useState(
    initial?.counterpartyId ?? "",
  );
  const [counterpartyText, setCounterpartyText] = useState("");
  const [cpMode, setCpMode] = useState<"dir" | "text">("dir");
  const [note, setNote] = useState(initial?.note ?? "");
  const [profitOverride, setProfitOverride] = useState(
    initial?.profitOverride != null ? String(initial.profitOverride) : "",
  );
  const [lines, setLines] = useState<DraftLine[]>([]);

  const [debtModal, setDebtModal] = useState<{
    debts: Awaited<ReturnType<typeof getCounterpartyOpenDebtsAction>>;
  } | null>(null);
  const [debtId, setDebtId] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtRate, setDebtRate] = useState("");
  const [debtPayLegs, setDebtPayLegs] = useState<
    { key: string; walletId: string; amount: string; rateUsd: string }[]
  >([]);

  function initDebtPayLegs(
    debt: Awaited<ReturnType<typeof getCounterpartyOpenDebtsAction>>[number],
  ) {
    const side = debt.direction === "they_owe_us" ? "inn" : "out";
    const w = wallets.find((x) => x.id === debt.walletId);
    setDebtId(debt.id);
    setDebtAmount(String(debt.remaining));
    setDebtRate(suggestedRateForWallet(w, side));
    setDebtPayLegs([
      {
        key: newKey(),
        walletId: debt.walletId,
        amount: String(debt.remaining),
        rateUsd: suggestedRateForWallet(w, side),
      },
    ]);
  }

  // Reset when opening / switching target
  useEffect(() => {
    if (!open) return;
    setError(null);
    setOperationDate(date);
    setCounterpartyId(initial?.counterpartyId ?? "");
    setCounterpartyText("");
    setCpMode("dir");
    setNote(initial?.note ?? "");
    setProfitOverride(
      initial?.profitOverride != null ? String(initial.profitOverride) : "",
    );
    setLines(
      initial?.lines.length
        ? initial.lines.map((l) => ({
            key: l.id,
            walletId: l.walletId,
            side: l.side,
            amount: String(l.amount),
            rateUsd: l.rateUsd != null ? String(l.rateUsd) : "",
          }))
        : [
            {
              key: newKey(),
              walletId: wallets[0]?.id ?? "",
              side: "out" as LineSide,
              amount: "",
              rateUsd: suggestedRateForWallet(wallets[0], "out"),
            },
            {
              key: newKey(),
              walletId: wallets[1]?.id ?? wallets[0]?.id ?? "",
              side: "inn" as LineSide,
              amount: "",
              rateUsd: suggestedRateForWallet(wallets[1] ?? wallets[0], "inn"),
            },
          ],
    );
    setDebtModal(null);
  }, [open, initial?.id, date]); // wallets/initial snapshot only on open

  const walletMap = useMemo(
    () => Object.fromEntries(wallets.map((w) => [w.id, w])),
    [wallets],
  );

  const liveCalc = useMemo(() => {
    const calcLines: CalcLine[] = lines.map((l) => {
      const currencyCode = walletMap[l.walletId]?.currencyCode;
      return {
        id: l.key,
        side: l.side,
        walletId: l.walletId,
        currencyCode,
        walletName: walletMap[l.walletId]?.name,
        amount: parseDecimalInput(l.amount) ?? 0,
        rateUsd: lineRate(l.rateUsd, currencyCode),
      };
    });
    const filled = fillMissingRates(calcLines);
    return {
      filled,
      summary: formatCalcSummary(filled.lines),
      autoPl: autoProfitUsd(filled.lines),
    };
  }, [lines, walletMap]);

  if (!open) return null;

  const manualPl = parseDecimalInput(profitOverride);
  const displayPl =
    manualPl != null
      ? { value: manualPl, source: "manual" as const }
      : liveCalc.autoPl != null
        ? { value: liveCalc.autoPl, source: "auto" as const }
        : null;

  function addLine(side: LineSide) {
    const w = wallets[0];
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        walletId: w?.id ?? "",
        side,
        amount: "",
        rateUsd: suggestedRateForWallet(w, side),
      },
    ]);
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (patch.walletId) {
          const w = walletMap[patch.walletId];
          next.rateUsd = suggestedRateForWallet(w, next.side);
        }
        return next;
      }),
    );
  }

  async function doSave(opts: {
    skipDebt?: boolean;
    confirmProfit?: boolean;
    withDebt?: boolean;
  }) {
    if (savingRef.current) return;
    if (!operationDate) {
      setError("Вкажіть дату");
      return;
    }
    savingRef.current = true;
    setError(null);
    try {
      const result = await saveJournalPositionAction({
        positionId: initial?.id,
        date: operationDate,
        counterpartyId: cpMode === "dir" ? counterpartyId : undefined,
        counterpartyText: cpMode === "text" ? counterpartyText : undefined,
        note: note || undefined,
        profitOverride: profitOverride || undefined,
        confirmProfitOverride: opts.confirmProfit,
        skipDebtPrompt: opts.skipDebt || opts.withDebt,
        lines: lines.map(
          (l): PositionLineInput => ({
            walletId: l.walletId,
            side: l.side,
            amount: l.amount,
            rateUsd: l.rateUsd || undefined,
          }),
        ),
        debtRepayment:
          opts.withDebt && debtId
            ? {
                debtId,
                debtAmount: debtAmount || undefined,
                debtRateUsd: debtRate,
                legs: debtPayLegs.map((l) => ({
                  walletId: l.walletId,
                  amount: l.amount,
                  rateUsd: l.rateUsd,
                })),
              }
            : undefined,
      });

      if (!result.ok) {
        if ("needsDebtConfirm" in result && result.needsDebtConfirm) {
          const cpId = cpMode === "dir" ? counterpartyId : "";
          if (cpId) {
            const debts = await getCounterpartyOpenDebtsAction(cpId);
            const first = debts[0];
            setDebtModal({ debts });
            if (first) initDebtPayLegs(first);
            else {
              setDebtId("");
              setDebtAmount("");
              setDebtRate("");
              setDebtPayLegs([]);
            }
          } else {
            savingRef.current = false;
            await doSave({ skipDebt: true, confirmProfit: opts.confirmProfit });
            return;
          }
          return;
        }
        if ("needsProfitConfirm" in result && result.needsProfitConfirm) {
          const auto = "autoProfit" in result ? result.autoProfit : null;
          if (
            window.confirm(
              `Авто P/L = $${auto}. Замінити на $${profitOverride}?`,
            )
          ) {
            savingRef.current = false;
            await doSave({ ...opts, confirmProfit: true, skipDebt: true });
            return;
          }
          return;
        }
        setError(result.error);
        return;
      }

      setDebtModal(null);
      onClose();
      router.refresh();
    } finally {
      savingRef.current = false;
    }
  }

  function requestClose() {
    if (
      !window.confirm(
        "Вийти без збереження? Незбережені зміни буде втрачено.",
      )
    ) {
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Закрити"
        onClick={requestClose}
      />
      <div className="ui-panel relative z-10 flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-visible">
        <div className="relative z-20 flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold">
              {initial
                ? initial.counterpartyLabel
                : "Новий запис у журналі"}
            </h2>
            {canEdit ? (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[11px] text-text-muted">Дата</span>
                <DatePicker
                  value={operationDate}
                  onChange={setOperationDate}
                />
              </div>
            ) : (
              <p className="mt-0.5 text-[12px] text-text-muted">
                {formatDate(operationDate)}
              </p>
            )}
          </div>
          <button
            type="button"
            className="ui-btn ui-btn-ghost h-8 w-8 shrink-0 p-0"
            onClick={requestClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-b-[var(--radius)] p-4">
          {!canEdit ? (
            <p className="text-[13px] text-text-muted">Лише перегляд</p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                start(() => doSave({}));
              }}
            >
              <div>
                <span className="ui-label">Контрагент</span>
                <div className="mb-1 flex gap-1">
                  <button
                    type="button"
                    className={`ui-btn h-7 text-[11px] ${cpMode === "dir" ? "ui-btn-primary" : "ui-btn-secondary"}`}
                    onClick={() => setCpMode("dir")}
                  >
                    Довідник
                  </button>
                  <button
                    type="button"
                    className={`ui-btn h-7 text-[11px] ${cpMode === "text" ? "ui-btn-primary" : "ui-btn-secondary"}`}
                    onClick={() => setCpMode("text")}
                  >
                    Новий
                  </button>
                </div>
                {cpMode === "dir" ? (
                  <select
                    value={counterpartyId}
                    onChange={(e) => setCounterpartyId(e.target.value)}
                    className="ui-input"
                    required
                  >
                    <option value="">—</option>
                    {counterparties.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={counterpartyText}
                    onChange={(e) => setCounterpartyText(e.target.value)}
                    className="ui-input"
                    required
                    placeholder="Ім'я"
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] text-text-muted">
                  Зліва — що віддали клієнту, справа — що отримали.
                </p>
                <button
                  type="button"
                  className="ui-btn ui-btn-ghost h-8 shrink-0 text-[12px]"
                  onClick={() => {
                    const filled = liveCalc.filled.lines;
                    setLines((prev) =>
                      prev.map((l) => {
                        const f = filled.find((x) => x.id === l.key);
                        if (!f) return l;
                        return {
                          ...l,
                          amount: f.amount > 0 ? String(f.amount) : l.amount,
                          rateUsd:
                            f.rateUsd != null ? String(f.rateUsd) : l.rateUsd,
                        };
                      }),
                    );
                  }}
                >
                  Автокурс
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <SidePanel
                  title="Віддали"
                  hint="з наших кас"
                  tone="out"
                  lines={lines.filter((l) => l.side === "out")}
                  wallets={wallets}
                  filledLines={liveCalc.filled.lines}
                  onAdd={() => addLine("out")}
                  onUpdate={updateLine}
                  onRemove={(key) =>
                    setLines((prev) => prev.filter((x) => x.key !== key))
                  }
                  usdTotal={liveCalc.summary.usdOut}
                />
                <SidePanel
                  title="Отримали"
                  hint="на наші каси"
                  tone="inn"
                  lines={lines.filter((l) => l.side === "inn")}
                  wallets={wallets}
                  filledLines={liveCalc.filled.lines}
                  onAdd={() => addLine("inn")}
                  onUpdate={updateLine}
                  onRemove={(key) =>
                    setLines((prev) => prev.filter((x) => x.key !== key))
                  }
                  usdTotal={liveCalc.summary.usdIn}
                />
              </div>

              <div className="rounded-[var(--radius)] border border-border bg-bg p-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-text-muted">
                      Віддали (USD)
                    </div>
                    <div className="font-mono-num text-[14px] font-medium text-danger">
                      {liveCalc.summary.usdOut != null
                        ? `$${formatMoney(liveCalc.summary.usdOut)}`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-text-muted">
                      P/L
                      {displayPl?.source === "manual" ? (
                        <span className="ml-1 normal-case tracking-normal text-accent">
                          вручну
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={`font-mono-num text-[16px] font-semibold ${
                        displayPl == null
                          ? "text-text-muted"
                          : displayPl.value >= 0
                            ? "text-success"
                            : "text-danger"
                      }`}
                    >
                      {displayPl != null
                        ? `${displayPl.value >= 0 ? "+" : ""}$${formatMoney(displayPl.value)}`
                        : "немає курсів"}
                    </div>
                    {displayPl?.source === "manual" &&
                    liveCalc.autoPl != null ? (
                      <div className="mt-0.5 font-mono-num text-[10px] text-text-muted">
                        авто {liveCalc.autoPl >= 0 ? "+" : ""}$
                        {formatMoney(liveCalc.autoPl)}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-text-muted">
                      Отримали (USD)
                    </div>
                    <div className="font-mono-num text-[14px] font-medium text-success">
                      {liveCalc.summary.usdIn != null
                        ? `$${formatMoney(liveCalc.summary.usdIn)}`
                        : "—"}
                    </div>
                  </div>
                </div>
                {liveCalc.summary.missingRates.length > 0 ? (
                  <p className="mt-2 text-center text-[12px] font-medium text-danger">
                    Курси не виставлені:{" "}
                    {liveCalc.summary.missingRates.join(", ")}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <label>
                  <span className="ui-label">P/L вручну (USD)</span>
                  <input
                    value={profitOverride}
                    onChange={(e) => setProfitOverride(e.target.value)}
                    className="ui-input font-mono-num"
                    placeholder={
                      liveCalc.autoPl != null ? String(liveCalc.autoPl) : ""
                    }
                  />
                </label>
                <label>
                  <span className="ui-label">Примітка</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="ui-input"
                    placeholder="опційно"
                  />
                </label>
              </div>

              {error ? (
                <p className="text-[13px] text-danger">{error}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="ui-btn ui-btn-primary"
                >
                  {pending ? "…" : "Зберегти"}
                </button>
                {initial ? (
                  <button
                    type="button"
                    className="ui-btn ui-btn-danger"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Видалити запис і відкотити каси?"))
                        return;
                      start(async () => {
                        await deleteJournalPositionAction(initial.id);
                        onClose();
                        router.refresh();
                      });
                    }}
                  >
                    Видалити
                  </button>
                ) : null}
              </div>
            </form>
          )}
        </div>
      </div>

      {debtModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="ui-panel flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-semibold">Відкритий борг у контрагента</h3>
              <p className="mt-1 text-[13px] text-text-muted">
                У{" "}
                <span className="font-medium text-text">
                  {cpMode === "dir"
                    ? (counterparties.find((c) => c.id === counterpartyId)
                        ?.name ?? "контрагента")
                    : counterpartyText || "контрагента"}
                </span>{" "}
                є незакритий борг. Запис журналу збережеться в будь-якому разі —
                нижче можна додатково списати борг однією чи кількома валютами.
              </p>
            </div>

            <div className="overflow-y-auto px-4 py-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                Який борг списати
              </p>
              <ul className="space-y-2">
                {debtModal.debts.map((d) => {
                  const theyOwe = d.direction === "they_owe_us";
                  const selected = debtId === d.id;
                  return (
                    <li key={d.id}>
                      <label
                        className={`flex cursor-pointer gap-2.5 rounded-[var(--radius)] border p-3 transition ${
                          selected
                            ? theyOwe
                              ? "border-success/50 bg-[color-mix(in_oklab,var(--success)_8%,var(--surface))]"
                              : "border-danger/50 bg-[color-mix(in_oklab,var(--danger)_8%,var(--surface))]"
                            : "border-border bg-surface hover:bg-surface-2"
                        }`}
                      >
                        <input
                          type="radio"
                          className="mt-1"
                          checked={selected}
                          onChange={() => initDebtPayLegs(d)}
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className={`text-[12px] font-semibold ${
                              theyOwe ? "text-success" : "text-danger"
                            }`}
                          >
                            {theyOwe
                              ? "Нам винні (контрагент → ми)"
                              : "Ми винні (ми → контрагент)"}
                          </div>
                          <div className="mt-0.5 text-[13px] text-text">
                            Облік боргу:{" "}
                            <span className="font-medium">{d.walletName}</span>
                            {" · "}
                            <span className="font-mono-num font-medium">
                              {formatMoney(d.remaining)} {d.currencyCode}
                            </span>
                          </div>
                          {d.note ? (
                            <p className="mt-1 text-[12px] text-text-muted">
                              {d.note}
                            </p>
                          ) : null}
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>

              {(() => {
                const selected = debtModal.debts.find((d) => d.id === debtId);
                if (!selected) return null;
                const theyOwe = selected.direction === "they_owe_us";
                const side = theyOwe ? "inn" : "out";
                const debtRateN = parseDecimalInput(debtRate);
                const payments = debtPayLegs.map((l) => {
                  const amt = parseDecimalInput(l.amount) ?? 0;
                  const rate = parseDecimalInput(l.rateUsd);
                  const w = wallets.find((x) => x.id === l.walletId);
                  const usd =
                    rate != null && rate > 0 && amt > 0 ? amt / rate : null;
                  return { ...l, amt, rate, usd, wallet: w };
                });
                const paymentsUsd = payments.reduce(
                  (s, p) => s + (p.usd ?? 0),
                  0,
                );
                const fromPayments =
                  debtRateN != null && debtRateN > 0
                    ? Number((paymentsUsd * debtRateN).toFixed(4))
                    : null;
                const explicit = parseDecimalInput(debtAmount);
                const writeOff = (() => {
                  let w = Math.min(
                    selected.remaining,
                    fromPayments ?? 0,
                  );
                  if (explicit != null && explicit > 0) {
                    w = Math.min(w, explicit);
                  }
                  return w;
                })();

                return (
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                          Чим гасимо ({theyOwe ? "отримаємо на каси" : "віддамо з кас"})
                        </p>
                        <button
                          type="button"
                          className="ui-btn ui-btn-ghost h-7 text-[11px]"
                          onClick={() => {
                            const w = wallets[0];
                            setDebtPayLegs((prev) => [
                              ...prev,
                              {
                                key: newKey(),
                                walletId: w?.id ?? "",
                                amount: "",
                                rateUsd: suggestedRateForWallet(w, side),
                              },
                            ]);
                          }}
                        >
                          <Plus size={12} /> Валюта
                        </button>
                      </div>
                      <div className="space-y-2">
                        {debtPayLegs.map((leg) => (
                          <div
                            key={leg.key}
                            className="rounded-[var(--radius)] border border-border bg-surface p-2"
                          >
                            <div className="mb-1.5 flex items-center gap-1">
                              <select
                                value={leg.walletId}
                                onChange={(e) => {
                                  const wid = e.target.value;
                                  const w = wallets.find((x) => x.id === wid);
                                  setDebtPayLegs((prev) =>
                                    prev.map((x) =>
                                      x.key === leg.key
                                        ? {
                                            ...x,
                                            walletId: wid,
                                            rateUsd: suggestedRateForWallet(
                                              w,
                                              side,
                                            ),
                                          }
                                        : x,
                                    ),
                                  );
                                }}
                                className="ui-input min-w-0 flex-1 text-[13px]"
                              >
                                {wallets.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {w.name} ({w.currencyCode})
                                  </option>
                                ))}
                              </select>
                              {debtPayLegs.length > 1 ? (
                                <button
                                  type="button"
                                  className="ui-btn ui-btn-ghost h-8 w-8 shrink-0 p-0"
                                  aria-label="Видалити"
                                  onClick={() =>
                                    setDebtPayLegs((prev) =>
                                      prev.filter((x) => x.key !== leg.key),
                                    )
                                  }
                                >
                                  <Trash size={14} />
                                </button>
                              ) : null}
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <label>
                                <span className="ui-label">Сума</span>
                                <input
                                  value={leg.amount}
                                  onChange={(e) =>
                                    setDebtPayLegs((prev) =>
                                      prev.map((x) =>
                                        x.key === leg.key
                                          ? { ...x, amount: e.target.value }
                                          : x,
                                      ),
                                    )
                                  }
                                  className="ui-input font-mono-num"
                                  inputMode="decimal"
                                />
                              </label>
                              <label>
                                <span className="ui-label">
                                  Курс → USD (
                                  {theyOwe ? "купівля" : "продаж"})
                                </span>
                                <input
                                  value={leg.rateUsd}
                                  onChange={(e) =>
                                    setDebtPayLegs((prev) =>
                                      prev.map((x) =>
                                        x.key === leg.key
                                          ? { ...x, rateUsd: e.target.value }
                                          : x,
                                      ),
                                    )
                                  }
                                  className="ui-input font-mono-num"
                                  inputMode="decimal"
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label>
                        <span className="ui-label">
                          Списати з боргу ({selected.currencyCode})
                        </span>
                        <input
                          value={debtAmount}
                          onChange={(e) => setDebtAmount(e.target.value)}
                          className="ui-input font-mono-num"
                          inputMode="decimal"
                          placeholder={
                            fromPayments != null
                              ? String(fromPayments)
                              : String(selected.remaining)
                          }
                        />
                      </label>
                      <label>
                        <span className="ui-label">
                          Курс боргу {selected.currencyCode}→USD
                        </span>
                        <input
                          value={debtRate}
                          onChange={(e) => setDebtRate(e.target.value)}
                          className="ui-input font-mono-num"
                          inputMode="decimal"
                        />
                      </label>
                    </div>

                    <div className="rounded-[var(--radius)] border border-border bg-bg p-3 text-[12px] leading-relaxed text-text-muted">
                      <p className="font-medium text-text">Що станеться</p>
                      <ol className="mt-2 list-decimal space-y-1.5 pl-4">
                        <li>Збережеться поточний запис журналу без змін.</li>
                        <li>
                          Борг ({selected.walletName}) зменшиться на{" "}
                          <span className="font-mono-num font-medium text-text">
                            {formatMoney(writeOff)} {selected.currencyCode}
                          </span>
                          {paymentsUsd > 0
                            ? ` (оплата ≈ $${formatMoney(paymentsUsd)})`
                            : ""}
                          .
                        </li>
                        {payments
                          .filter((p) => p.amt > 0)
                          .map((p) => (
                            <li key={p.key}>
                              {theyOwe ? (
                                <>
                                  На «{p.wallet?.name ?? "касу"}»{" "}
                                  <span className="font-medium text-success">
                                    +{formatMoney(p.amt)}{" "}
                                    {p.wallet?.currencyCode}
                                  </span>
                                </>
                              ) : (
                                <>
                                  З «{p.wallet?.name ?? "каси"}»{" "}
                                  <span className="font-medium text-danger">
                                    −{formatMoney(p.amt)}{" "}
                                    {p.wallet?.currencyCode}
                                  </span>
                                </>
                              )}
                              {p.usd != null
                                ? ` ≈ $${formatMoney(p.usd)}`
                                : ""}
                            </li>
                          ))}
                        <li>
                          В історії — окрема операція «Повернути борг».
                        </li>
                      </ol>
                      <p className="mt-2 border-t border-border pt-2">
                        <span className="font-medium text-text">«Ні»</span> —
                        лише журнал.{" "}
                        <span className="font-medium text-text">«Скасувати»</span>{" "}
                        — без збереження.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                className="ui-btn ui-btn-primary"
                disabled={
                  !debtId ||
                  !parseDecimalInput(debtRate) ||
                  !debtPayLegs.some(
                    (l) =>
                      (parseDecimalInput(l.amount) ?? 0) > 0 &&
                      (parseDecimalInput(l.rateUsd) ?? 0) > 0,
                  )
                }
                onClick={() =>
                  start(() => doSave({ withDebt: true, skipDebt: true }))
                }
              >
                Так, списати борг
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-secondary"
                onClick={() => start(() => doSave({ skipDebt: true }))}
              >
                Ні, лише журнал
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-ghost"
                onClick={() => setDebtModal(null)}
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function JournalPositionsBoard({
  data,
  canEdit = true,
}: {
  data: JournalDayData;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<{
    open: boolean;
    position: PositionView | null;
  }>({ open: false, position: null });
  const [mode, setMode] = useState<"day" | "range">(
    data.isRange ? "range" : "day",
  );

  useEffect(() => {
    setMode(data.isRange ? "range" : "day");
  }, [data.isRange]);

  const colCount = data.wallets.length + 3; // name + wallets + ops + pl

  function goDay(iso: string) {
    router.push(`/work/journal?date=${iso}`);
  }

  function goRange(from: string, to: string) {
    const a = from <= to ? from : to;
    const b = from <= to ? to : from;
    router.push(`/work/journal?from=${a}&to=${b}`);
  }

  const title =
    data.isRange
      ? `Журнал · ${formatDate(data.dateFrom)} – ${formatDate(data.dateTo)}`
      : `Журнал дня · ${formatDate(data.date)}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">
            {title} · {data.branchName}
          </h2>
          <p className="text-[12px] text-text-muted">
            Клік по рядку — відкрити запис
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-[var(--radius)] border border-border p-0.5">
            <button
              type="button"
              className={`h-7 rounded-[calc(var(--radius)-2px)] px-2.5 text-[12px] transition ${
                mode === "day"
                  ? "bg-accent text-accent-fg"
                  : "text-text-muted hover:text-text"
              }`}
              onClick={() => {
                setMode("day");
                if (data.isRange) goDay(data.dateTo);
              }}
            >
              День
            </button>
            <button
              type="button"
              className={`h-7 rounded-[calc(var(--radius)-2px)] px-2.5 text-[12px] transition ${
                mode === "range"
                  ? "bg-accent text-accent-fg"
                  : "text-text-muted hover:text-text"
              }`}
              onClick={() => setMode("range")}
            >
              Період
            </button>
          </div>
          {mode === "day" ? (
            <DatePicker value={data.date} onChange={goDay} />
          ) : (
            <DateRangePicker
              from={data.dateFrom}
              to={data.dateTo}
              onChange={({ from, to }) => goRange(from, to)}
            />
          )}
          {canEdit && mode === "day" ? (
            <button
              type="button"
              className="ui-btn ui-btn-primary"
              onClick={() => setModal({ open: true, position: null })}
            >
              <Plus size={14} weight="bold" />
              Додати
            </button>
          ) : null}
        </div>
      </div>

      <div className="ui-panel overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[12px] sm:text-[13px]">
          <thead className="sticky top-0 z-20">
            <tr className="bg-[color-mix(in_oklab,var(--accent)_18%,var(--surface-2))]">
              <th className="sticky left-0 z-30 border-b border-border bg-[color-mix(in_oklab,var(--accent)_18%,var(--surface-2))] px-2 py-2 text-left font-medium text-text">
                Ім&apos;я
              </th>
              {data.wallets.map((w) => (
                <th
                  key={w.id}
                  className="border-b border-border px-2 py-2 text-right font-medium text-text"
                >
                  <span className="inline-flex items-center justify-end gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: w.color }}
                    />
                    {w.name}
                  </span>
                </th>
              ))}
              <th className="border-b border-border px-2 py-2 text-left font-medium text-text">
                Операції
              </th>
              <th className="border-b border-border px-2 py-2 text-right font-medium text-text">
                +/−
              </th>
            </tr>
            <tr className="bg-accent-soft/80">
              <td className="sticky left-0 z-30 border-b border-border bg-accent-soft px-2 py-1.5 text-[11px] font-medium text-accent">
                Початок
                {data.isRange ? (
                  <span className="ml-1 font-normal opacity-80">
                    · {formatDate(data.dateFrom)}
                  </span>
                ) : null}
              </td>
              {data.wallets.map((w) => (
                <td
                  key={w.id}
                  className="border-b border-border px-2 py-1.5 text-right font-mono-num text-accent"
                >
                  {formatMoney(data.opening[w.id] ?? 0)}
                </td>
              ))}
              <td className="border-b border-border" />
              <td className="border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {data.positions.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-3 py-8 text-center text-text-muted"
                >
                  Записів ще немає
                </td>
              </tr>
            ) : (
              data.positions.map((p, idx) => {
                const prevDate =
                  idx > 0 ? data.positions[idx - 1]?.operationDate : null;
                const showDateSep =
                  data.isRange && p.operationDate !== prevDate;
                return (
                  <JournalPositionRows
                    key={p.id}
                    position={p}
                    wallets={data.wallets}
                    colCount={colCount}
                    showDateSep={showDateSep}
                    onOpen={() => setModal({ open: true, position: p })}
                  />
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="bg-accent-soft">
              <td className="sticky left-0 z-10 bg-accent-soft px-2 py-2 text-[11px] font-medium text-accent">
                Кінець
                {data.isRange ? (
                  <span className="ml-1 font-normal opacity-80">
                    · {formatDate(data.dateTo)}
                  </span>
                ) : null}
              </td>
              {data.wallets.map((w) => (
                <td
                  key={w.id}
                  className="px-2 py-2 text-right font-mono-num font-medium text-accent"
                >
                  {formatMoney(data.closing[w.id] ?? 0)}
                </td>
              ))}
              <td />
              <td className="px-2 py-2 text-right font-mono-num font-medium text-success">
                {formatSignedMoney(
                  data.positions.reduce(
                    (s, p) => s + (p.displayProfit ?? 0),
                    0,
                  ),
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <PositionEditModal
        open={modal.open}
        onClose={() => setModal({ open: false, position: null })}
        wallets={data.wallets}
        counterparties={data.counterparties}
        date={modal.position?.operationDate ?? data.editDate}
        initial={modal.position}
        canEdit={canEdit}
      />
    </div>
  );
}

function JournalPositionRows({
  position: p,
  wallets,
  colCount,
  showDateSep,
  onOpen,
}: {
  position: PositionView;
  wallets: JournalDayData["wallets"];
  colCount: number;
  showDateSep: boolean;
  onOpen: () => void;
}) {
  return (
    <>
      {showDateSep ? (
        <tr>
          <td
            colSpan={colCount}
            className="bg-surface-2 px-2 py-1.5 text-[11px] font-medium text-text-muted"
          >
            {formatDate(p.operationDate)}
          </td>
        </tr>
      ) : null}
      <tr
        role="button"
        tabIndex={0}
        className="cursor-pointer border-b border-border hover:bg-[color-mix(in_oklab,var(--accent)_5%,transparent)]"
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        <td className="sticky left-0 z-10 bg-surface px-2 py-2 align-top font-medium text-text">
          {p.counterpartyLabel}
        </td>
        {wallets.map((w) => {
          const v = signedInWallet(p.lines, w.id);
          return (
            <td
              key={w.id}
              className={`px-2 py-2 text-right font-mono-num align-top ${
                v == null
                  ? "text-text-muted"
                  : v < 0
                    ? "text-danger"
                    : "text-success"
              }`}
            >
              {v == null ? "·" : formatSignedMoney(v)}
            </td>
          );
        })}
        <td className="max-w-[14rem] px-2 py-2 align-top text-[11px] leading-snug text-text-muted sm:max-w-[18rem] sm:text-[12px]">
          <div>{p.calcFlowText ?? p.calcText}</div>
          {p.missingRates?.length ? (
            <div className="mt-0.5 font-medium text-danger">
              Курси не виставлені: {p.missingRates.join(", ")}
            </div>
          ) : null}
        </td>
        <td
          className={`px-2 py-2 text-right font-mono-num align-top font-medium ${
            p.displayProfit == null
              ? "text-text-muted"
              : p.displayProfit >= 0
                ? "text-success"
                : "text-danger"
          }`}
        >
          {p.displayProfit == null
            ? "·"
            : formatSignedMoney(p.displayProfit)}
        </td>
      </tr>
    </>
  );
}
