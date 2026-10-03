"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOperationAction } from "@/lib/actions/operations";
import { formatMoney } from "@/lib/format";
import { toUsd } from "@/lib/money/usd";
import {
  RATE_HINT,
  TRANSACTION_TYPE_LABELS,
  type TransactionType,
} from "@/lib/types/domain";

type Wallet = {
  id: string;
  name: string;
  currencyCode: string;
  lastRateUsd?: number | null;
  lastBuyRateUsd?: number | null;
  lastSellRateUsd?: number | null;
};
type Counterparty = { id: string; name: string; temporary?: boolean };
type ExpenseCategory = { id: string; name: string };

const DEFAULT_TYPES: TransactionType[] = [
  "buy",
  "sell",
  "lend",
  "repay",
  "recolor",
  "expense",
];

function isTwoWallet(type: TransactionType) {
  return type === "buy" || type === "sell" || type === "recolor";
}

function usesWalletSingle(type: TransactionType) {
  return (
    type === "lend" ||
    type === "repay" ||
    type === "expense" ||
    type === "cash_in" ||
    type === "cash_out"
  );
}

export function NewOperationForm({
  wallets,
  counterparties,
  expenseCategories,
  recommendedRates,
  defaultType = "buy",
  defaultCounterpartyId,
  defaultDate,
  allowedTypes,
  onSuccess,
  embedded = false,
}: {
  wallets: Wallet[];
  counterparties: Counterparty[];
  expenseCategories: ExpenseCategory[];
  recommendedRates: Record<string, number>;
  defaultType?: TransactionType;
  defaultCounterpartyId?: string;
  defaultDate?: string;
  allowedTypes?: TransactionType[];
  onSuccess?: () => void;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const types = allowedTypes?.length ? allowedTypes : DEFAULT_TYPES;
  const initialType = types.includes(defaultType) ? defaultType : types[0]!;

  const [type, setType] = useState<TransactionType>(initialType);
  const [fromWalletId, setFromWalletId] = useState(wallets[0]?.id ?? "");
  const [toWalletId, setToWalletId] = useState(
    wallets[1]?.id ?? wallets[0]?.id ?? "",
  );
  const [debtWalletId, setDebtWalletId] = useState(wallets[0]?.id ?? "");
  const [counterpartyId, setCounterpartyId] = useState(
    defaultCounterpartyId ?? "",
  );
  const [counterpartyText, setCounterpartyText] = useState("");
  const [expenseCategoryId, setExpenseCategoryId] = useState(
    expenseCategories[0]?.id ?? "",
  );
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [rate, setRate] = useState("");
  const [profit, setProfit] = useState("");
  const [note, setNote] = useState("");
  const [operationDate, setOperationDate] = useState(
    defaultDate ?? new Date().toISOString().slice(0, 10),
  );

  const fromWallet = wallets.find((w) => w.id === fromWalletId);
  const debtWallet = wallets.find((w) => w.id === debtWalletId);

  const suggestedRate = useMemo(() => {
    const rateOf = (
      w: Wallet | undefined,
      side: "buy" | "sell" | "either",
    ) => {
      if (!w) return null;
      if (w.currencyCode === "USD") return 1;
      if (side === "buy") {
        return w.lastBuyRateUsd ?? w.lastRateUsd ?? w.lastSellRateUsd;
      }
      if (side === "sell") {
        return w.lastSellRateUsd ?? w.lastRateUsd ?? w.lastBuyRateUsd;
      }
      return w.lastRateUsd ?? w.lastBuyRateUsd ?? w.lastSellRateUsd;
    };

    let preferred: number | null | undefined;
    if (type === "buy") {
      const toWallet = wallets.find((w) => w.id === toWalletId);
      preferred = rateOf(toWallet, "buy") ?? rateOf(fromWallet, "sell");
    } else if (type === "sell") {
      preferred = rateOf(fromWallet, "sell");
    } else if (type === "repay" || type === "cash_in") {
      preferred = rateOf(debtWallet, "buy");
    } else if (type === "lend" || type === "expense" || type === "cash_out") {
      preferred = rateOf(debtWallet, "sell");
    } else {
      preferred = rateOf(fromWallet, "either") ?? rateOf(debtWallet, "either");
    }

    if (preferred != null && preferred > 0) return String(preferred);

    if (isTwoWallet(type) && fromWallet && toWalletId) {
      const toWallet = wallets.find((w) => w.id === toWalletId);
      if (toWallet) {
        const key = `${type}:${fromWallet.currencyCode}:${toWallet.currencyCode}`;
        const val = recommendedRates[key];
        if (val != null) return String(val);
      }
    }
    return "";
  }, [
    type,
    fromWallet,
    fromWalletId,
    toWalletId,
    debtWalletId,
    debtWallet,
    wallets,
    recommendedRates,
  ]);

  const rateUsed = Number(rate || suggestedRate) || null;

  const usdPreview = useMemo(() => {
    const amount = Number(inputAmount);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      rateUsed == null ||
      !(rateUsed > 0)
    ) {
      return null;
    }
    const usd = toUsd(amount, rateUsed);
    return Number.isFinite(usd) ? usd : null;
  }, [inputAmount, rateUsed]);

  function applySuggestedRate() {
    if (suggestedRate) setRate(suggestedRate);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const rateValue = rate.trim() || suggestedRate;
    if (!rateValue) {
      setError("Курс до USD обов'язковий");
      return;
    }

    start(async () => {
      const result = await createOperationAction({
        type: type as
          | "buy"
          | "sell"
          | "lend"
          | "repay"
          | "recolor"
          | "expense"
          | "cash_in"
          | "cash_out",
        rate: rateValue,
        inputAmount,
        outputAmount: isTwoWallet(type) ? outputAmount : undefined,
        fromWalletId: isTwoWallet(type) ? fromWalletId : undefined,
        toWalletId: isTwoWallet(type) ? toWalletId : undefined,
        debtWalletId: usesWalletSingle(type) ? debtWalletId : undefined,
        counterpartyId:
          type === "lend" || type === "repay"
            ? counterpartyId || undefined
            : undefined,
        counterpartyText:
          (type === "lend" || type === "repay") && !counterpartyId
            ? counterpartyText.trim() || undefined
            : undefined,
        expenseCategoryId: type === "expense" ? expenseCategoryId : undefined,
        profit:
          (type === "buy" || type === "sell") && profit.trim()
            ? profit
            : undefined,
        note: note.trim() || undefined,
        operationDate,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.refresh();
      onSuccess?.();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={embedded ? "space-y-3" : "space-y-4"}
    >
      <div>
        <label className="ui-label">Тип операції</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TransactionType)}
          className="ui-input"
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {TRANSACTION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {type === "cash_in" || type === "cash_out" ? (
          <p className="mt-1.5 text-[12px] text-text-muted">
            Лише зміна залишку каси. На дохід дня не впливає.
          </p>
        ) : null}
        {type === "recolor" ? (
          <p className="mt-1.5 text-[12px] text-text-muted">
            Перефарбування долара між касами (зміна «кольору» без угоди з
            клієнтом).
          </p>
        ) : null}
      </div>

      <div>
        <label className="ui-label">Дата операції</label>
        <input
          type="date"
          value={operationDate}
          onChange={(e) => setOperationDate(e.target.value)}
          className="ui-input"
          required
        />
      </div>

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

      {usesWalletSingle(type) ? (
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
            {expenseCategories.length === 0 ? (
              <option value="">Немає категорій</option>
            ) : (
              expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        </div>
      ) : null}

      {(type === "lend" || type === "repay") && (
        <div className="space-y-3">
          <div>
            <label className="ui-label">Контрагент</label>
            <select
              value={counterpartyId}
              onChange={(e) => setCounterpartyId(e.target.value)}
              className="ui-input"
            >
              <option value="">— новий / вільний текст —</option>
              {counterparties.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.temporary ? " (тимч.)" : ""}
                </option>
              ))}
            </select>
          </div>
          {!counterpartyId ? (
            <div>
              <label className="ui-label">Ім&apos;я контрагента</label>
              <input
                value={counterpartyText}
                onChange={(e) => setCounterpartyText(e.target.value)}
                className="ui-input"
                placeholder="Якщо не обрано зі списку"
                required
              />
            </div>
          ) : null}
        </div>
      )}

      {!isTwoWallet(type) ? (
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

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="ui-label mb-0">{RATE_HINT}</label>
          {suggestedRate && !rate ? (
            <button
              type="button"
              onClick={applySuggestedRate}
              className="ui-btn ui-btn-ghost h-7 px-2 text-[12px]"
            >
              останній {suggestedRate}
            </button>
          ) : null}
        </div>
        <input
          type="number"
          step="any"
          min="0"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder={suggestedRate || "41.50"}
          className="ui-input font-mono-num"
          required
        />
        {debtWallet && !isTwoWallet(type) ? (
          <p className="mt-1 text-[12px] text-text-muted">
            Валюта: {debtWallet.currencyCode}
          </p>
        ) : null}
      </div>

      {usdPreview != null && rateUsed != null ? (
        <p className="font-mono-num text-[13px] text-text-muted">
          ≈ ${formatMoney(usdPreview, 4)} · курс {formatMoney(rateUsed, 6)}
        </p>
      ) : null}

      {(type === "buy" || type === "sell") && (
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

      {error ? <p className="text-[13px] text-danger">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="ui-btn ui-btn-primary"
        >
          {pending ? "Збереження…" : "Створити операцію"}
        </button>
      </div>
    </form>
  );
}
