"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { repayDebtAction } from "@/lib/actions/entities";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { DataPagination } from "@/components/ui/DataPagination";
import { useClientList } from "@/lib/list/use-client-list";
import { formatDate, formatMoney } from "@/lib/format";
import { toUsd } from "@/lib/money/usd";
import { RATE_HINT } from "@/lib/types/domain";
import {
  NewOperationModal,
  type OpFormData,
} from "@/components/operations/NewOperationModal";

export type DebtItem = {
  id: string;
  direction: "they_owe_us" | "we_owe_them";
  amount: number;
  remaining: number;
  note: string | null;
  counterpartyId: string;
  counterpartyName: string;
  walletId: string;
  walletName: string;
  currencyCode: string;
  createdAt: string;
};

function RepayForm({
  debt,
  suggestedRate,
}: {
  debt: DebtItem;
  suggestedRate: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(String(debt.remaining));
  const [rate, setRate] = useState(
    debt.currencyCode === "USD"
      ? "1"
      : suggestedRate != null
        ? String(suggestedRate)
        : "",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const usdPreview = useMemo(() => {
    const a = Number(amount.replace(",", "."));
    const r = Number(rate.replace(",", "."));
    if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(r) || r <= 0)
      return null;
    const usd = toUsd(a, r);
    return Number.isFinite(usd) ? usd : null;
  }, [amount, rate]);

  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        setError(null);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            await repayDebtAction(fd);
            router.refresh();
          } catch {
            setError("Не вдалося погасити борг");
          }
        });
      }}
    >
      <input type="hidden" name="debtId" value={debt.id} />
      <div className="min-w-[6rem]">
        <label className="ui-label">Сума</label>
        <input
          name="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="ui-input font-mono-num"
          inputMode="decimal"
          required
          disabled={pending}
        />
      </div>
      <div className="min-w-[6rem]">
        <label className="ui-label">{RATE_HINT}</label>
        <input
          name="rate"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="ui-input font-mono-num"
          inputMode="decimal"
          placeholder={suggestedRate != null ? String(suggestedRate) : ""}
          required
          disabled={pending}
        />
      </div>
      <div className="min-w-[8rem] flex-1">
        <label className="ui-label">Примітка</label>
        <input
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="ui-input"
          disabled={pending}
        />
      </div>
      {usdPreview != null ? (
        <p className="font-mono-num text-[12px] text-text-muted">
          ≈ ${formatMoney(usdPreview, 4)} · курс{" "}
          {formatMoney(Number(rate.replace(",", ".")), 6)}
        </p>
      ) : null}
      {error ? (
        <p className="w-full text-[12px] text-danger">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="ui-btn ui-btn-primary h-[34px]"
      >
        {pending ? "…" : "Погасити"}
      </button>
    </form>
  );
}

function totalsByCurrency(items: DebtItem[]) {
  const map = new Map<string, number>();
  for (const d of items) {
    map.set(d.currencyCode, (map.get(d.currencyCode) ?? 0) + d.remaining);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function DebtSection({
  title,
  tone,
  debts,
  canCreate,
  lastRates,
}: {
  title: string;
  tone: "in" | "out";
  debts: DebtItem[];
  canCreate: boolean;
  lastRates: Record<string, number>;
}) {
  const list = useClientList({
    items: debts,
    getSearchValues: (d) => [
      d.counterpartyName,
      d.walletName,
      d.currencyCode,
      d.note ?? "",
      d.remaining,
    ],
    getSortValue: (d, key) => {
      if (key === "name") return d.counterpartyName;
      if (key === "amount") return d.remaining;
      if (key === "date") return d.createdAt;
      return d.counterpartyName;
    },
    initialSort: "date",
    initialDir: "desc",
  });

  const totals = totalsByCurrency(debts);

  return (
    <Panel className="overflow-hidden p-0">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 ${
          tone === "in"
            ? "bg-[color-mix(in_oklab,var(--success)_6%,var(--surface))]"
            : "bg-[color-mix(in_oklab,var(--danger)_6%,var(--surface))]"
        }`}
      >
        <div>
          <h3
            className={`text-[14px] font-semibold ${
              tone === "in" ? "text-success" : "text-danger"
            }`}
          >
            {title}
          </h3>
          <p className="text-[12px] text-text-muted">
            Активних: {debts.length}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 font-mono-num text-[13px]">
          {totals.length === 0 ? (
            <span className="text-text-muted">—</span>
          ) : (
            totals.map(([code, sum]) => (
              <span
                key={code}
                className={
                  tone === "in" ? "text-success" : "text-danger"
                }
              >
                {formatMoney(sum)} {code}
              </span>
            ))
          )}
        </div>
      </div>

      <ListToolbar
        q={list.q}
        onSearch={list.setSearch}
        pageSize={list.pageSize}
        onPageSize={list.setPageSize}
        searchPlaceholder="Пошук…"
      />

      <div className="overflow-x-auto">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Контрагент</th>
              <th>Каса</th>
              <th className="text-right">Залишок</th>
              <th>Деталі</th>
            </tr>
          </thead>
          <tbody>
            {list.pageItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-text-muted">
                  Немає записів
                </td>
              </tr>
            ) : (
              list.pageItems.map((d) => (
                <tr key={d.id} className="align-top">
                  <td className="whitespace-nowrap text-[12px] text-text-muted">
                    {formatDate(d.createdAt)}
                  </td>
                  <td>
                    <Link
                      href={`/counterparties/${d.counterpartyId}`}
                      className="font-medium text-text hover:text-accent"
                    >
                      {d.counterpartyName}
                    </Link>
                  </td>
                  <td>
                    {d.walletName}{" "}
                    <span className="text-text-muted">{d.currencyCode}</span>
                  </td>
                  <td
                    className={`text-right font-mono-num font-medium ${
                      tone === "in" ? "text-success" : "text-danger"
                    }`}
                  >
                    {tone === "in" ? "+" : "−"}
                    {formatMoney(d.remaining)} {d.currencyCode}
                  </td>
                  <td>
                    <p className="text-[12px] text-text-muted">
                      з {formatMoney(d.amount)} {d.currencyCode}
                      {d.note ? ` · ${d.note}` : ""}
                    </p>
                    {canCreate ? (
                      <RepayForm
                        debt={d}
                        suggestedRate={lastRates[d.walletId] ?? null}
                      />
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DataPagination
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        pageSize={list.pageSize}
        onPage={list.setPage}
      />
    </Panel>
  );
}

export function DebtsBoard({
  debts,
  wallets,
  canCreate,
  opForm,
  lastRates = {},
}: {
  debts: DebtItem[];
  wallets: { id: string; name: string }[];
  canCreate: boolean;
  opForm: OpFormData;
  lastRates?: Record<string, number>;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const theyOwe = useMemo(
    () => debts.filter((d) => d.direction === "they_owe_us"),
    [debts],
  );
  const weOwe = useMemo(
    () => debts.filter((d) => d.direction === "we_owe_them"),
    [debts],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Активні борги"
        description="Відкриті борги по валютах (без змішування сум)"
        actions={
          canCreate ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="ui-btn ui-btn-primary"
            >
              <Plus size={16} weight="bold" />
              Нова позика
            </button>
          ) : null
        }
      />

      <DebtSection
        title="Нам винні"
        tone="in"
        debts={theyOwe}
        canCreate={canCreate}
        lastRates={lastRates}
      />
      <DebtSection
        title="Ми винні"
        tone="out"
        debts={weOwe}
        canCreate={canCreate}
        lastRates={lastRates}
      />

      {wallets.length > 0 ? null : (
        <p className="text-[13px] text-text-muted">Немає активних кас</p>
      )}

      <NewOperationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        opForm={opForm}
        defaultType="lend"
      />
    </div>
  );
}
