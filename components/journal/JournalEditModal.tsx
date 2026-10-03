"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOperationAction } from "@/lib/actions/operations";
import {
  RATE_HINT,
  TRANSACTION_TYPE_LABELS,
  type TransactionType,
} from "@/lib/types/domain";
import { formatMoney } from "@/lib/format";
import { toUsd } from "@/lib/money/usd";
import type { JournalRow } from "@/components/journal/DayJournal";
import { X } from "@phosphor-icons/react";

type Wallet = { id: string; name: string; currencyCode: string };
type Counterparty = { id: string; name: string };
type ExpenseCategory = { id: string; name: string };

export function JournalEditModal({
  row,
  wallets,
  counterparties,
  expenseCategories,
  onClose,
}: {
  row: JournalRow | null;
  wallets: Wallet[];
  counterparties: Counterparty[];
  expenseCategories: ExpenseCategory[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const type = row?.type as TransactionType | undefined;

  const [fromWalletId, setFromWalletId] = useState(row?.fromWalletId ?? "");
  const [toWalletId, setToWalletId] = useState(row?.toWalletId ?? "");
  const [debtWalletId, setDebtWalletId] = useState(row?.debtWalletId ?? "");
  const [counterpartyId, setCounterpartyId] = useState(row?.counterpartyId ?? "");
  const [inputAmount, setInputAmount] = useState(
    row?.inputAmount != null ? String(row.inputAmount) : "",
  );
  const [outputAmount, setOutputAmount] = useState(
    row?.outputAmount != null ? String(row.outputAmount) : "",
  );
  const [rate, setRate] = useState(row?.rate != null ? String(row.rate) : "");
  const [profit, setProfit] = useState(
    row?.profit != null ? String(row.profit) : "",
  );
  const [note, setNote] = useState(row?.note ?? "");
  const [expenseCategoryId, setExpenseCategoryId] = useState(
    expenseCategories[0]?.id ?? "",
  );

  const usdPreview = useMemo(() => {
    const amount = Number(inputAmount);
    const rateVal = Number(rate);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rateVal) || rateVal <= 0) {
      return null;
    }
    const usd = toUsd(amount, rateVal);
    return Number.isFinite(usd) ? usd : null;
  }, [inputAmount, rate]);

  if (!row || !type) return null;

  const rowId = row.id;
  const opType: TransactionType = type;
  const isTwoWallet =
    opType === "buy" || opType === "sell" || opType === "recolor";
  const isDebt =
    opType === "lend" || opType === "repay" || opType === "expense";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!rate.trim()) {
      setError("Курс до USD обов'язковий");
      return;
    }

    start(async () => {
      const result = await updateOperationAction({
        operationId: rowId,
        type: opType as
          | "buy"
          | "sell"
          | "lend"
          | "repay"
          | "recolor"
          | "expense"
          | "cash_in"
          | "cash_out"
          | "exchange",
        rate: rate.trim(),
        inputAmount,
        outputAmount: isTwoWallet ? outputAmount : undefined,
        fromWalletId: isTwoWallet ? fromWalletId : undefined,
        toWalletId: isTwoWallet ? toWalletId : undefined,
        debtWalletId: isDebt ? debtWalletId : undefined,
        counterpartyId:
          opType === "lend" || opType === "repay"
            ? counterpartyId || undefined
            : undefined,
        expenseCategoryId: opType === "expense" ? expenseCategoryId : undefined,
        profit:
          (opType === "buy" || opType === "sell") && profit.trim()
            ? profit
            : undefined,
        note: note.trim() || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="ui-panel w-full max-w-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold text-text">
            Редагування · {TRANSACTION_TYPE_LABELS[type]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ui-btn ui-btn-ghost h-8 w-8 p-0"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 p-4">
          {isTwoWallet ? (
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
                        {w.name}
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
                        {w.name}
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

          {isDebt && type !== "expense" ? (
            <>
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
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ui-label">Контрагент</label>
                <select
                  value={counterpartyId}
                  onChange={(e) => setCounterpartyId(e.target.value)}
                  className="ui-input"
                  required
                >
                  {counterparties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ui-label">Сума</label>
                <input
                  type="number"
                  step="any"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="ui-input font-mono-num"
                  required
                />
              </div>
            </>
          ) : null}

          {type === "expense" ? (
            <>
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
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ui-label">Категорія</label>
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
              <div>
                <label className="ui-label">Сума</label>
                <input
                  type="number"
                  step="any"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="ui-input font-mono-num"
                  required
                />
              </div>
            </>
          ) : null}

          <div>
            <label className="ui-label">{RATE_HINT}</label>
            <input
              type="number"
              step="any"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="ui-input font-mono-num"
              required
            />
          </div>

          {usdPreview != null ? (
            <p className="font-mono-num text-[13px] text-text-muted">
              ≈ ${formatMoney(usdPreview, 4)} USD
            </p>
          ) : null}

          {(type === "buy" || type === "sell") && (
            <div>
              <label className="ui-label">Прибуток</label>
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

          {error ? <p className="text-[13px] text-danger">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="ui-btn ui-btn-secondary"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={pending}
              className="ui-btn ui-btn-primary"
            >
              {pending ? "Збереження…" : "Зберегти"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
