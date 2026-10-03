"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Plus, Trash, X } from "@phosphor-icons/react";
import { updateOperationAction } from "@/lib/actions/operations";
import {
  RATE_HINT,
  TRANSACTION_TYPE_LABELS,
  type TransactionType,
} from "@/lib/types/domain";
import { formatMoney, formatSignedMoney } from "@/lib/format";
import { toUsd } from "@/lib/money/usd";

type Wallet = {
  id: string;
  name: string;
  currencyCode: string;
  balance?: number;
  lastRateUsd?: number | null;
};
type Counterparty = { id: string; name: string; temporary?: boolean };
type ExpenseCategory = { id: string; name: string };

export type EditableHistoryOperation = {
  id: string;
  type: TransactionType;
  note: string | null;
  rate: number | null;
  profit: number | null;
  counterpartyId: string | null;
  expenseCategoryId: string | null;
  fromWalletId: string | null;
  toWalletId: string | null;
  debtWalletId: string | null;
  inputAmount: number | null;
  outputAmount: number | null;
  legs: {
    id: string;
    walletId: string;
    walletName: string;
    amount: number;
    rateUsd?: number | null;
  }[];
};

function isTwoWallet(type: TransactionType) {
  return type === "buy" || type === "sell" || type === "recolor";
}

function isSingleWallet(type: TransactionType) {
  return (
    type === "lend" ||
    type === "repay" ||
    type === "expense" ||
    type === "cash_in" ||
    type === "cash_out"
  );
}

function buildNewLegs(input: {
  type: TransactionType;
  fromWalletId: string;
  toWalletId: string;
  debtWalletId: string;
  inputAmount: string;
  outputAmount: string;
  rate: string;
  exchangeLegs?: { walletId: string; amount: string; rateUsd: string }[];
}): { walletId: string; amount: number }[] | null {
  if (input.type === "exchange") {
    const legs = input.exchangeLegs ?? [];
    if (legs.length < 2) return null;
    const parsed = legs.map((leg) => {
      const amount = Number(leg.amount);
      const rateUsd = Number(leg.rateUsd);
      if (
        !leg.walletId ||
        !Number.isFinite(amount) ||
        amount === 0 ||
        !Number.isFinite(rateUsd) ||
        rateUsd <= 0
      ) {
        return null;
      }
      return { walletId: leg.walletId, amount };
    });
    if (parsed.some((p) => p == null)) return null;
    const ok = parsed as { walletId: string; amount: number }[];
    if (new Set(ok.map((l) => l.walletId)).size !== ok.length) return null;
    return ok;
  }

  const rateVal = Number(input.rate);
  if (!Number.isFinite(rateVal) || rateVal <= 0) return null;

  if (isTwoWallet(input.type)) {
    const inputAmt = Number(input.inputAmount);
    const outputAmt = Number(input.outputAmount);
    if (
      !Number.isFinite(inputAmt) ||
      inputAmt === 0 ||
      !Number.isFinite(outputAmt) ||
      outputAmt === 0 ||
      !input.fromWalletId ||
      !input.toWalletId ||
      input.fromWalletId === input.toWalletId
    ) {
      return null;
    }
    return [
      { walletId: input.fromWalletId, amount: -Math.abs(inputAmt) },
      { walletId: input.toWalletId, amount: Math.abs(outputAmt) },
    ];
  }

  if (isSingleWallet(input.type)) {
    const amount = Number(input.inputAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !input.debtWalletId) {
      return null;
    }
    let signed: number;
    if (
      input.type === "lend" ||
      input.type === "expense" ||
      input.type === "cash_out"
    ) {
      signed = -Math.abs(amount);
    } else {
      signed = Math.abs(amount);
    }
    return [{ walletId: input.debtWalletId, amount: signed }];
  }

  return null;
}

export function HistoryEditModal({
  operation,
  wallets,
  counterparties,
  expenseCategories,
  onClose,
}: {
  operation: EditableHistoryOperation;
  wallets: Wallet[];
  counterparties: Counterparty[];
  expenseCategories: ExpenseCategory[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const type = operation.type;
  const [fromWalletId, setFromWalletId] = useState(
    operation.fromWalletId ?? "",
  );
  const [toWalletId, setToWalletId] = useState(operation.toWalletId ?? "");
  const [debtWalletId, setDebtWalletId] = useState(
    operation.debtWalletId ?? "",
  );
  const [counterpartyId, setCounterpartyId] = useState(
    operation.counterpartyId ?? "",
  );
  const [expenseCategoryId, setExpenseCategoryId] = useState(
    operation.expenseCategoryId ?? expenseCategories[0]?.id ?? "",
  );
  const [inputAmount, setInputAmount] = useState(
    operation.inputAmount != null ? String(operation.inputAmount) : "",
  );
  const [outputAmount, setOutputAmount] = useState(
    operation.outputAmount != null ? String(operation.outputAmount) : "",
  );
  const [rate, setRate] = useState(
    operation.rate != null ? String(operation.rate) : "",
  );
  const [profit, setProfit] = useState(
    operation.profit != null ? String(operation.profit) : "",
  );
  const [note, setNote] = useState(operation.note ?? "");
  const [exchangeLegs, setExchangeLegs] = useState(() => {
    const fromOp = operation.legs.map((l) => ({
      walletId: l.walletId,
      amount: String(l.amount),
      rateUsd: String(l.rateUsd ?? operation.rate ?? 1),
    }));
    if (fromOp.length >= 2) return fromOp;
    const fallback = wallets.slice(0, 2).map((w) => ({
      walletId: w.id,
      amount: "",
      rateUsd: String(w.lastRateUsd ?? operation.rate ?? 1),
    }));
    return [...fromOp, ...fallback].slice(0, Math.max(2, fromOp.length));
  });

  const oldLegs = operation.legs;

  const consequences = useMemo(() => {
    const newLegs = buildNewLegs({
      type,
      fromWalletId,
      toWalletId,
      debtWalletId,
      inputAmount,
      outputAmount,
      rate,
      exchangeLegs,
    });
    if (!newLegs) return null;

    const net = new Map<string, number>();
    for (const leg of oldLegs) {
      net.set(leg.walletId, (net.get(leg.walletId) ?? 0) - leg.amount);
    }
    for (const leg of newLegs) {
      net.set(leg.walletId, (net.get(leg.walletId) ?? 0) + leg.amount);
    }

    const rows = [...net.entries()]
      .map(([walletId, delta]) => {
        const w = wallets.find((x) => x.id === walletId);
        if (!w) return null;
        const before = w.balance ?? 0;
        const after = before + delta;
        return {
          walletId,
          walletName: w.name,
          currencyCode: w.currencyCode,
          before,
          after,
          delta,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r != null)
      .filter((r) => Math.abs(r.delta) > 1e-9);

    return rows;
  }, [
    type,
    fromWalletId,
    toWalletId,
    debtWalletId,
    inputAmount,
    outputAmount,
    rate,
    exchangeLegs,
    oldLegs,
    wallets,
  ]);

  const usdPreview = useMemo(() => {
    const amount = Number(inputAmount);
    const rateVal = Number(rate);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(rateVal) ||
      rateVal <= 0
    ) {
      return null;
    }
    const usd = toUsd(amount, rateVal);
    return Number.isFinite(usd) ? usd : null;
  }, [inputAmount, rate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (type !== "exchange" && !rate.trim()) {
      setError("Курс до USD обов'язковий");
      return;
    }
    if (type === "exchange") {
      if (exchangeLegs.length < 2) {
        setError("Обмін потребує щонайменше двох кас");
        return;
      }
      if (
        exchangeLegs.some(
          (l) =>
            !l.walletId ||
            !l.amount.trim() ||
            !l.rateUsd.trim() ||
            !Number.isFinite(Number(l.amount)) ||
            Number(l.amount) === 0 ||
            !(Number(l.rateUsd) > 0),
        )
      ) {
        setError("Заповніть касу, суму (±) і курс для кожної ноги");
        return;
      }
    }

    start(async () => {
      const result = await updateOperationAction({
        operationId: operation.id,
        type: type as
          | "buy"
          | "sell"
          | "lend"
          | "repay"
          | "recolor"
          | "expense"
          | "cash_in"
          | "cash_out"
          | "exchange",
        rate:
          type === "exchange"
            ? exchangeLegs[0]?.rateUsd || rate.trim() || "1"
            : rate.trim(),
        inputAmount: type === "exchange" ? "0" : inputAmount,
        outputAmount: isTwoWallet(type) ? outputAmount : undefined,
        fromWalletId: isTwoWallet(type) ? fromWalletId : undefined,
        toWalletId: isTwoWallet(type) ? toWalletId : undefined,
        debtWalletId: isSingleWallet(type) ? debtWalletId : undefined,
        counterpartyId:
          type === "lend" || type === "repay" || type === "exchange"
            ? counterpartyId || undefined
            : undefined,
        expenseCategoryId: type === "expense" ? expenseCategoryId : undefined,
        profit:
          (type === "buy" || type === "sell" || type === "exchange") &&
          profit.trim()
            ? profit
            : undefined,
        note: note.trim() || undefined,
        legs:
          type === "exchange"
            ? exchangeLegs.map((l) => ({
                walletId: l.walletId,
                amount: l.amount,
                rateUsd: l.rateUsd,
              }))
            : undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function updateExchangeLeg(
    index: number,
    patch: Partial<(typeof exchangeLegs)[number]>,
  ) {
    setExchangeLegs((prev) =>
      prev.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)),
    );
  }

  function addExchangeLeg() {
    const used = new Set(exchangeLegs.map((l) => l.walletId));
    const next = wallets.find((w) => !used.has(w.id)) ?? wallets[0];
    if (!next) return;
    setExchangeLegs((prev) => [
      ...prev,
      {
        walletId: next.id,
        amount: "",
        rateUsd: String(next.lastRateUsd ?? 1),
      },
    ]);
  }

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div
        className="ui-panel flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden shadow-lg"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold text-text">
            Редагування · {TRANSACTION_TYPE_LABELS[type]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ui-btn ui-btn-ghost h-8 w-8 p-0"
            aria-label="Закрити"
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="space-y-3 overflow-y-auto px-4 py-3">
            {type === "exchange" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    Каси обміну
                  </p>
                  <button
                    type="button"
                    onClick={addExchangeLeg}
                    className="ui-btn ui-btn-ghost h-7 gap-1 px-2 text-[12px]"
                  >
                    <Plus size={14} />
                    Додати касу
                  </button>
                </div>
                {exchangeLegs.map((leg, index) => (
                  <div
                    key={index}
                    className="rounded-[var(--radius)] border border-border bg-surface-2 p-2.5"
                  >
                    <div className="mb-1.5 flex items-center gap-1">
                      <select
                        value={leg.walletId}
                        onChange={(e) => {
                          const wid = e.target.value;
                          const w = wallets.find((x) => x.id === wid);
                          updateExchangeLeg(index, {
                            walletId: wid,
                            rateUsd:
                              w?.lastRateUsd != null
                                ? String(w.lastRateUsd)
                                : leg.rateUsd,
                          });
                        }}
                        className="ui-input min-w-0 flex-1"
                        required
                      >
                        {wallets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.currencyCode})
                          </option>
                        ))}
                      </select>
                      {exchangeLegs.length > 2 ? (
                        <button
                          type="button"
                          className="ui-btn ui-btn-ghost h-8 w-8 shrink-0 p-0"
                          aria-label="Видалити ногу"
                          onClick={() =>
                            setExchangeLegs((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <Trash size={14} />
                        </button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="ui-label">Сума (±)</label>
                        <input
                          type="number"
                          step="any"
                          value={leg.amount}
                          onChange={(e) =>
                            updateExchangeLeg(index, {
                              amount: e.target.value,
                            })
                          }
                          className="ui-input font-mono-num"
                          required
                        />
                      </div>
                      <div>
                        <label className="ui-label">{RATE_HINT}</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={leg.rateUsd}
                          onChange={(e) =>
                            updateExchangeLeg(index, {
                              rateUsd: e.target.value,
                            })
                          }
                          className="ui-input font-mono-num"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-text-muted">
                  Від&apos;ємна сума — списання з каси, додатна — зарахування.
                </p>
              </div>
            ) : null}

            {isTwoWallet(type) ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="ui-label">З каси</label>
                    <select
                      value={fromWalletId}
                      onChange={(e) => setFromWalletId(e.target.value)}
                      className="ui-input"
                      required
                    >
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.currencyCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="ui-label">На касу</label>
                    <select
                      value={toWalletId}
                      onChange={(e) => setToWalletId(e.target.value)}
                      className="ui-input"
                      required
                    >
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.currencyCode})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="ui-label">Списання</label>
                    <input
                      type="number"
                      step="any"
                      value={inputAmount}
                      onChange={(e) => setInputAmount(e.target.value)}
                      className="ui-input font-mono-num"
                      required
                    />
                  </div>
                  <div>
                    <label className="ui-label">Зарахування</label>
                    <input
                      type="number"
                      step="any"
                      value={outputAmount}
                      onChange={(e) => setOutputAmount(e.target.value)}
                      className="ui-input font-mono-num"
                      required
                    />
                  </div>
                </div>
              </>
            ) : null}

            {isSingleWallet(type) ? (
              <div>
                <label className="ui-label">Каса</label>
                <select
                  value={debtWalletId}
                  onChange={(e) => setDebtWalletId(e.target.value)}
                  className="ui-input"
                  required
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.currencyCode})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {type === "expense" ? (
              <div>
                <label className="ui-label">Категорія витрат</label>
                <select
                  value={expenseCategoryId}
                  onChange={(e) => setExpenseCategoryId(e.target.value)}
                  className="ui-input"
                  required
                >
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {(type === "lend" || type === "repay" || type === "exchange") && (
              <div>
                <label className="ui-label">
                  Контрагент
                  {type === "exchange" ? " (необов'язково)" : ""}
                </label>
                <select
                  value={counterpartyId}
                  onChange={(e) => setCounterpartyId(e.target.value)}
                  className="ui-input"
                  required={type !== "exchange"}
                >
                  <option value="">— оберіть —</option>
                  {counterparties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.temporary ? " (тимч.)" : ""}
                    </option>
                  ))}
                </select>
                {type === "lend" || type === "repay" ? (
                  <p className="mt-1 text-[11px] text-warning">
                    Залишок боргу в розділі «Борги» при редагуванні не
                    синхронізується автоматично.
                  </p>
                ) : null}
              </div>
            )}

            {isSingleWallet(type) ? (
              <div>
                <label className="ui-label">Сума</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="ui-input font-mono-num"
                  required
                />
              </div>
            ) : null}

            {type !== "exchange" ? (
              <div>
                <label className="ui-label">{RATE_HINT}</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="ui-input font-mono-num"
                  required
                />
                {usdPreview != null ? (
                  <p className="mt-1 font-mono-num text-[12px] text-text-muted">
                    ≈ ${formatMoney(usdPreview, 4)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {(type === "buy" || type === "sell" || type === "exchange") && (
              <div>
                <label className="ui-label">Прибуток (необов&apos;язково)</label>
                <input
                  type="number"
                  step="any"
                  value={profit}
                  onChange={(e) => setProfit(e.target.value)}
                  className="ui-input font-mono-num"
                />
              </div>
            )}

            <div>
              <label className="ui-label">Примітка</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="ui-input"
              />
            </div>

            <div className="rounded-[var(--radius)] border border-border bg-surface-2 px-3 py-2.5">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                Наслідки для кас
              </p>
              {consequences == null ? (
                <p className="text-[12px] text-text-muted">
                  Введіть коректні суми й каси — тут з’явиться, як зміняться
                  залишки.
                </p>
              ) : consequences.length === 0 ? (
                <p className="text-[12px] text-text-muted">
                  Змін залишків не буде (ті самі суми й каси).
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {consequences.map((r) => (
                    <li
                      key={r.walletId}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[12px]"
                    >
                      <span className="font-medium text-text">
                        {r.walletName}
                      </span>
                      <span className="font-mono-num text-text-muted">
                        {formatMoney(r.before)} →{" "}
                        <span className="text-text">
                          {formatMoney(r.after)}
                        </span>{" "}
                        {r.currencyCode}
                        <span
                          className={
                            r.delta > 0
                              ? "text-success"
                              : r.delta < 0
                                ? "text-danger"
                                : ""
                          }
                        >
                          {" "}
                          ({formatSignedMoney(r.delta)})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              disabled={pending}
              onClick={onClose}
              className="ui-btn ui-btn-ghost"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={pending || consequences == null}
              className="ui-btn ui-btn-primary"
            >
              {pending ? "…" : "Зберегти"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
