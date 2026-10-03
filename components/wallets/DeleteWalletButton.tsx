"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Plus, Trash, X } from "@phosphor-icons/react";
import {
  deleteWalletAction,
  getDeleteWalletPreviewAction,
  type DeleteWalletPreview,
} from "@/lib/actions/wallets";
import { formatMoney, parseDecimalInput } from "@/lib/format";
import { RATE_HINT } from "@/lib/types/domain";
import { toUsd } from "@/lib/money/usd";

type DestRow = {
  key: string;
  walletId: string;
  amount: string;
  rateUsd: string;
  /** true = значення підставлено автоматично, можна перезаписати */
  amountAuto?: boolean;
  rateAuto?: boolean;
};

function newKey() {
  return Math.random().toString(36).slice(2, 9);
}

function fmtCalc(n: number, decimals = 4): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  const fixed = n.toFixed(decimals);
  return String(Number(fixed));
}

function suggestedRate(
  t:
    | {
        currencyCode: string;
        lastRateUsd: number | null;
        lastBuyRateUsd: number | null;
        lastSellRateUsd: number | null;
      }
    | undefined,
  moneyLeaves: boolean,
) {
  if (!t) return "";
  if (t.currencyCode === "USD") return "1";
  const preferred = moneyLeaves
    ? (t.lastSellRateUsd ?? t.lastRateUsd ?? t.lastBuyRateUsd)
    : (t.lastBuyRateUsd ?? t.lastRateUsd ?? t.lastSellRateUsd);
  return preferred != null && preferred > 0 ? String(preferred) : "";
}

/**
 * Дораховує відсутні / auto-поля з того, що вже відомо.
 * sourceAmount фіксований (абс. баланс).
 * USD = amount / rate.
 */
function reconcileTransfer(input: {
  sourceAmount: number;
  sourceRate: string;
  sourceRateAuto: boolean;
  dests: DestRow[];
}): { sourceRate: string; sourceRateAuto: boolean; dests: DestRow[] } {
  let sourceRate = input.sourceRate;
  let sourceRateAuto = input.sourceRateAuto;
  let dests = input.dests.map((d) => ({ ...d }));
  const absAmt = Math.abs(input.sourceAmount);
  if (!(absAmt > 0)) {
    return { sourceRate, sourceRateAuto, dests };
  }

  const parsePos = (raw: string) => {
    const n = parseDecimalInput(raw);
    return n != null && n > 0 ? n : null;
  };

  // Кілька проходів — поки щось змінюється
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;

    let srcR = parsePos(sourceRate);
    let sourceUsd = srcR != null ? toUsd(absAmt, srcR) : null;

    // Усі dest повні → можна вивести курс джерела
    if (sourceUsd == null || sourceRateAuto) {
      let destUsdSum = 0;
      let allFull = dests.length > 0;
      for (const d of dests) {
        const a = parsePos(d.amount);
        const r = parsePos(d.rateUsd);
        if (a == null || r == null) {
          allFull = false;
          break;
        }
        destUsdSum += toUsd(a, r);
      }
      if (allFull && destUsdSum > 0) {
        const next = fmtCalc(absAmt / destUsdSum);
        if (next && (sourceRateAuto || !sourceRate.trim())) {
          if (sourceRate !== next) {
            sourceRate = next;
            sourceRateAuto = true;
            changed = true;
          }
          sourceUsd = destUsdSum;
          srcR = parsePos(sourceRate);
        }
      }
    }

    srcR = parsePos(sourceRate);
    sourceUsd = srcR != null ? toUsd(absAmt, srcR) : null;

    if (sourceUsd != null && sourceUsd > 0) {
      // Відомий USD по повних ногах
      let knownUsd = 0;
      const partialIdx: number[] = [];
      dests.forEach((d, i) => {
        const a = parsePos(d.amount);
        const r = parsePos(d.rateUsd);
        if (a != null && r != null) {
          knownUsd += toUsd(a, r);
        } else if (a != null || r != null || !d.amount.trim() || !d.rateUsd.trim()) {
          if (!(a != null && r != null)) partialIdx.push(i);
        }
      });

      // Одна нога — класика: 2 з 3 → третє
      if (dests.length === 1) {
        const d = dests[0]!;
        const a = parsePos(d.amount);
        const r = parsePos(d.rateUsd);
        if (r != null && (a == null || d.amountAuto)) {
          const next = fmtCalc(sourceUsd * r, 2);
          if (next && d.amount !== next) {
            dests[0] = { ...d, amount: next, amountAuto: true };
            changed = true;
          }
        } else if (a != null && (r == null || d.rateAuto)) {
          const next = fmtCalc(a / sourceUsd);
          if (next && d.rateUsd !== next) {
            dests[0] = { ...d, rateUsd: next, rateAuto: true };
            changed = true;
          }
        }
      } else if (partialIdx.length === 1) {
        // Кілька ніг: лише одна неповна → добиваємо залишок USD
        const i = partialIdx[0]!;
        const d = dests[i]!;
        const a = parsePos(d.amount);
        const r = parsePos(d.rateUsd);
        const leftover = sourceUsd - knownUsd;
        if (leftover > 1e-8) {
          if (r != null && (a == null || d.amountAuto)) {
            const next = fmtCalc(leftover * r, 2);
            if (next && d.amount !== next) {
              dests[i] = { ...d, amount: next, amountAuto: true };
              changed = true;
            }
          } else if (a != null && (r == null || d.rateAuto)) {
            const next = fmtCalc(a / leftover);
            if (next && d.rateUsd !== next) {
              dests[i] = { ...d, rateUsd: next, rateAuto: true };
              changed = true;
            }
          }
        }
      } else {
        // Кілька неповних: кожну з відомим курсом і порожньою/auto сумою
        // не чіпаємо (немає однозначного розподілу), крім ніг де є курс
        // і користувач ще не задав суму — лише якщо рівно одна така з курсом
        const rateOnly = dests
          .map((d, i) => ({ d, i, a: parsePos(d.amount), r: parsePos(d.rateUsd) }))
          .filter((x) => x.r != null && (x.a == null || x.d.amountAuto));
        if (rateOnly.length === 1 && partialIdx.length === rateOnly.length) {
          const { i, d, r } = rateOnly[0]!;
          const leftover = sourceUsd - knownUsd;
          if (leftover > 1e-8 && r != null) {
            const next = fmtCalc(leftover * r, 2);
            if (next && d.amount !== next) {
              dests[i] = { ...d, amount: next, amountAuto: true };
              changed = true;
            }
          }
        }
      }
    }

    // Одна dest з amount+rate, sourceRate порожній/auto
    if (dests.length === 1) {
      const d = dests[0]!;
      const a = parsePos(d.amount);
      const r = parsePos(d.rateUsd);
      if (a != null && r != null && (sourceRateAuto || !sourceRate.trim())) {
        const destUsd = toUsd(a, r);
        if (destUsd > 0) {
          const next = fmtCalc(absAmt / destUsd);
          if (next && sourceRate !== next) {
            sourceRate = next;
            sourceRateAuto = true;
            changed = true;
          }
        }
      }
    }

    if (!changed) break;
  }

  return { sourceRate, sourceRateAuto, dests };
}

export function DeleteWalletButton({
  walletId,
  walletName,
}: {
  walletId: string;
  walletName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-[var(--radius-control)] border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/5"
      >
        Видалити касу
      </button>
      {open ? (
        <DeleteWalletModal
          walletId={walletId}
          walletName={walletName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function DeleteWalletModal({
  walletId,
  walletName,
  onClose,
}: {
  walletId: string;
  walletName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DeleteWalletPreview | null>(null);
  const [sourceRate, setSourceRate] = useState("");
  const [sourceRateAuto, setSourceRateAuto] = useState(false);
  const [dests, setDests] = useState<DestRow[]>([]);
  const [note, setNote] = useState("");

  function applyReconcile(
    nextRate: string,
    nextRateAuto: boolean,
    nextDests: DestRow[],
  ) {
    if (!preview) {
      setSourceRate(nextRate);
      setSourceRateAuto(nextRateAuto);
      setDests(nextDests);
      return;
    }
    const filled = reconcileTransfer({
      sourceAmount: preview.wallet.balance,
      sourceRate: nextRate,
      sourceRateAuto: nextRateAuto,
      dests: nextDests,
    });
    setSourceRate(filled.sourceRate);
    setSourceRateAuto(filled.sourceRateAuto);
    setDests(filled.dests);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const res = await getDeleteWalletPreviewAction(walletId);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setPreview(res);
      const bal = res.wallet.balance;
      const moneyLeavesSource = bal > 0;
      const initialRate = suggestedRate(res.wallet, moneyLeavesSource);
      setSourceRate(initialRate);
      setSourceRateAuto(Boolean(initialRate));

      if (res.needsTransfer && res.targets[0]) {
        const t = res.targets[0];
        const rate = suggestedRate(t, !moneyLeavesSource);
        const sameCcy = t.currencyCode === res.wallet.currencyCode;
        const initialDests: DestRow[] = [
          {
            key: newKey(),
            walletId: t.id,
            amount: sameCcy ? String(Math.abs(bal)) : "",
            rateUsd: rate,
            amountAuto: sameCcy,
            rateAuto: Boolean(rate),
          },
        ];
        const filled = reconcileTransfer({
          sourceAmount: bal,
          sourceRate: initialRate,
          sourceRateAuto: Boolean(initialRate),
          dests: initialDests,
        });
        setSourceRate(filled.sourceRate);
        setSourceRateAuto(filled.sourceRateAuto);
        setDests(filled.dests);
      } else {
        setDests([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [walletId]);

  const moneyLeavesSource = (preview?.wallet.balance ?? 0) > 0;

  const usdCheck = useMemo(() => {
    if (!preview?.needsTransfer) return null;
    const rate = parseDecimalInput(sourceRate);
    const absBal = Math.abs(preview.wallet.balance);
    const sourceUsd =
      rate != null && rate > 0 ? toUsd(absBal, rate) : null;

    let destUsd = 0;
    let destComplete = dests.length > 0;
    for (const row of dests) {
      const a = parseDecimalInput(row.amount);
      const r = parseDecimalInput(row.rateUsd);
      if (a == null || a <= 0 || r == null || r <= 0) {
        destComplete = false;
        break;
      }
      destUsd += toUsd(a, r);
    }

    if (sourceUsd == null && destComplete && destUsd > 0) {
      return {
        sourceUsd: destUsd,
        destUsd,
        delta: 0,
        partial: false,
      };
    }
    if (sourceUsd == null) return null;
    if (!destComplete) {
      return { sourceUsd, destUsd: null as number | null, delta: null, partial: true };
    }
    return {
      sourceUsd,
      destUsd,
      delta: destUsd - sourceUsd,
      partial: false,
    };
  }, [preview, sourceRate, dests]);

  function handleConfirm() {
    setError(null);
    start(async () => {
      const res = await deleteWalletAction({
        walletId,
        sourceRateUsd: sourceRate || undefined,
        note: note.trim() || undefined,
        destinations: preview?.needsTransfer
          ? dests.map((d) => ({
              walletId: d.walletId,
              amount: d.amount,
              rateUsd: d.rateUsd,
            }))
          : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div
        className="ui-panel flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden shadow-lg"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-text">
              Видалити касу
            </h2>
            <p className="text-[12px] text-text-muted">{walletName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-btn ui-btn-ghost h-8 w-8 p-0"
            aria-label="Закрити"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="text-[13px] text-text-muted">Завантаження…</p>
          ) : null}

          {preview?.blockers.length ? (
            <ul className="space-y-1 rounded-[var(--radius)] border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
              {preview.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}

          {preview && !preview.needsTransfer && !preview.blockers.length ? (
            <p className="text-[13px] text-text">
              Баланс каси = 0. Касу буде деактивовано (історія операцій
              збережеться).
            </p>
          ) : null}

          {preview?.needsTransfer && !preview.blockers.length ? (
            <>
              <p className="text-[13px] text-text-muted">
                Баланс не нульовий — переведіть кошти в інші каси. Достатньо
                двох чисел з трьох (курс зліва / сума / курс справа) — третє
                підставиться само. USD зліва і справа мають збігатися.
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[var(--radius)] border border-border bg-surface-2 p-3">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                    З каси (видаляємо)
                  </p>
                  <p className="font-medium text-text">
                    {preview.wallet.name}
                  </p>
                  <p className="mt-1 font-mono-num text-lg text-text">
                    {formatMoney(preview.wallet.balance)}{" "}
                    <span className="text-sm text-text-muted">
                      {preview.wallet.currencyCode}
                    </span>
                  </p>
                  <label className="mt-3 block">
                    <span className="ui-label">
                      {RATE_HINT}
                      {sourceRateAuto ? (
                        <span className="ml-1 font-normal normal-case text-accent">
                          · авто
                        </span>
                      ) : null}
                    </span>
                    <input
                      className="ui-input font-mono-num"
                      value={sourceRate}
                      onChange={(e) => {
                        const v = e.target.value;
                        applyReconcile(v, false, dests);
                      }}
                      inputMode="decimal"
                    />
                  </label>
                  {usdCheck?.sourceUsd != null ? (
                    <p className="mt-1 font-mono-num text-[12px] text-text-muted">
                      ≈ ${formatMoney(usdCheck.sourceUsd, 4)}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-[var(--radius)] border border-border bg-surface-2 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                      {moneyLeavesSource
                        ? "На каси (розподіл)"
                        : "З кас (покриття мінусу)"}
                    </p>
                    <button
                      type="button"
                      className="ui-btn ui-btn-ghost h-7 gap-1 px-2 text-[12px]"
                      onClick={() => {
                        const used = new Set(dests.map((d) => d.walletId));
                        const next =
                          preview.targets.find((t) => !used.has(t.id)) ??
                          preview.targets[0];
                        if (!next) return;
                        const rate = suggestedRate(next, !moneyLeavesSource);
                        applyReconcile(sourceRate, sourceRateAuto, [
                          ...dests,
                          {
                            key: newKey(),
                            walletId: next.id,
                            amount: "",
                            rateUsd: rate,
                            rateAuto: Boolean(rate),
                          },
                        ]);
                      }}
                    >
                      <Plus size={12} />
                      Каса
                    </button>
                  </div>

                  <div className="space-y-2">
                    {dests.map((row) => {
                      const t = preview.targets.find(
                        (x) => x.id === row.walletId,
                      );
                      return (
                        <div
                          key={row.key}
                          className="rounded-[var(--radius)] border border-border bg-surface p-2"
                        >
                          <div className="mb-1.5 flex gap-1">
                            <select
                              className="ui-input min-w-0 flex-1 text-[13px]"
                              value={row.walletId}
                              onChange={(e) => {
                                const id = e.target.value;
                                const tw = preview.targets.find(
                                  (x) => x.id === id,
                                );
                                const rate = suggestedRate(
                                  tw,
                                  !moneyLeavesSource,
                                );
                                applyReconcile(
                                  sourceRate,
                                  sourceRateAuto,
                                  dests.map((x) =>
                                    x.key === row.key
                                      ? {
                                          ...x,
                                          walletId: id,
                                          rateUsd: rate || x.rateUsd,
                                          rateAuto: Boolean(rate) || x.rateAuto,
                                        }
                                      : x,
                                  ),
                                );
                              }}
                            >
                              {preview.targets.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.name} ({opt.currencyCode})
                                </option>
                              ))}
                            </select>
                            {dests.length > 1 ? (
                              <button
                                type="button"
                                className="ui-btn ui-btn-ghost h-9 w-9 shrink-0 p-0"
                                onClick={() =>
                                  applyReconcile(
                                    sourceRate,
                                    sourceRateAuto,
                                    dests.filter((x) => x.key !== row.key),
                                  )
                                }
                              >
                                <Trash size={14} />
                              </button>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <label>
                              <span className="ui-label">
                                Сума
                                {t ? ` (${t.currencyCode})` : ""}
                                {row.amountAuto ? (
                                  <span className="ml-1 font-normal normal-case text-accent">
                                    · авто
                                  </span>
                                ) : null}
                              </span>
                              <input
                                className="ui-input font-mono-num"
                                value={row.amount}
                                onChange={(e) =>
                                  applyReconcile(
                                    sourceRate,
                                    sourceRateAuto,
                                    dests.map((x) =>
                                      x.key === row.key
                                        ? {
                                            ...x,
                                            amount: e.target.value,
                                            amountAuto: false,
                                          }
                                        : x,
                                    ),
                                  )
                                }
                                inputMode="decimal"
                              />
                            </label>
                            <label>
                              <span className="ui-label">
                                {RATE_HINT}
                                {row.rateAuto ? (
                                  <span className="ml-1 font-normal normal-case text-accent">
                                    · авто
                                  </span>
                                ) : null}
                              </span>
                              <input
                                className="ui-input font-mono-num"
                                value={row.rateUsd}
                                onChange={(e) =>
                                  applyReconcile(
                                    sourceRate,
                                    sourceRateAuto,
                                    dests.map((x) =>
                                      x.key === row.key
                                        ? {
                                            ...x,
                                            rateUsd: e.target.value,
                                            rateAuto: false,
                                          }
                                        : x,
                                    ),
                                  )
                                }
                                inputMode="decimal"
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {usdCheck && !usdCheck.partial && usdCheck.destUsd != null ? (
                    <p
                      className={`mt-2 font-mono-num text-[12px] ${
                        Math.abs(usdCheck.delta ?? 0) > 0.05
                          ? "text-danger"
                          : "text-success"
                      }`}
                    >
                      Розподіл ≈ ${formatMoney(usdCheck.destUsd, 4)}
                      {Math.abs(usdCheck.delta ?? 0) > 0.05
                        ? ` (різниця ${formatMoney(usdCheck.delta ?? 0, 4)})`
                        : " · OK"}
                    </p>
                  ) : usdCheck?.partial ? (
                    <p className="mt-2 text-[12px] text-text-muted">
                      Джерело ≈ ${formatMoney(usdCheck.sourceUsd, 4)} — допишіть
                      суму або курс справа, підставиться само.
                    </p>
                  ) : (
                    <p className="mt-2 text-[12px] text-text-muted">
                      Введіть курс зліва і курс/суму справа — решта
                      порахується.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : null}

          <div>
            <label className="ui-label">Примітка (необов&apos;язково)</label>
            <input
              className="ui-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            className="ui-btn ui-btn-ghost"
            disabled={pending}
            onClick={onClose}
          >
            Скасувати
          </button>
          <button
            type="button"
            className="ui-btn bg-danger text-white hover:opacity-90"
            disabled={
              pending ||
              loading ||
              Boolean(preview?.blockers.length) ||
              !preview
            }
            onClick={handleConfirm}
          >
            {pending
              ? "…"
              : preview?.needsTransfer
                ? "Перевести і видалити"
                : "Видалити"}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
