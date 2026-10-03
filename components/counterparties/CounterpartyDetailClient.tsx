"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import {
  promoteCounterpartyAction,
  repayDebtAction,
  updateCounterpartyAction,
} from "@/lib/actions/entities";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { DataPagination } from "@/components/ui/DataPagination";
import { useClientList } from "@/lib/list/use-client-list";
import { formatDateTime, formatMoney } from "@/lib/format";
import { toUsd } from "@/lib/money/usd";
import {
  RATE_HINT,
  TRANSACTION_TYPE_LABELS,
  type TransactionType,
} from "@/lib/types/domain";
import {
  NewOperationModal,
  type OpFormData,
} from "@/components/operations/NewOperationModal";

type Debt = {
  id: string;
  direction: string;
  remaining: number;
  amount: number;
  walletId: string;
  walletName: string;
  note: string | null;
};

function DebtRepayRow({
  debt,
  canCreate,
  suggestedRate,
}: {
  debt: Debt;
  canCreate: boolean;
  suggestedRate: number | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(debt.remaining));
  const [rate, setRate] = useState(
    suggestedRate != null ? String(suggestedRate) : "",
  );
  const [note, setNote] = useState("");

  const usdPreview = useMemo(() => {
    const a = Number(amount);
    const r = Number(rate);
    if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(r) || r <= 0) return null;
    return toUsd(a, r);
  }, [amount, rate]);

  if (!canCreate) {
    return (
      <li className="text-[13px]">
        {debt.walletName}: {formatMoney(debt.remaining)} з {formatMoney(debt.amount)}
      </li>
    );
  }

  return (
    <li className="rounded-[var(--radius)] border border-border p-2">
      <p className="text-[13px]">
        {debt.walletName}:{" "}
        <span className="font-mono-num">
          {formatMoney(debt.remaining)} / {formatMoney(debt.amount)}
        </span>
      </p>
      <form
        action={repayDebtAction}
        className="mt-2 flex flex-wrap items-end gap-2"
        onSubmit={() => setTimeout(() => router.refresh(), 0)}
      >
        <input type="hidden" name="debtId" value={debt.id} />
        <div>
          <label className="ui-label">Сума</label>
          <input
            name="amount"
            type="number"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="ui-input w-24 font-mono-num"
            required
          />
        </div>
        <div>
          <label className="ui-label">{RATE_HINT}</label>
          <input
            name="rate"
            type="number"
            step="any"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="ui-input w-24 font-mono-num"
            placeholder={suggestedRate != null ? String(suggestedRate) : ""}
            required
          />
        </div>
        <div className="flex-1">
          <label className="ui-label">Примітка</label>
          <input
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="ui-input"
          />
        </div>
        {usdPreview != null ? (
          <span className="font-mono-num text-[12px] text-text-muted">
            ≈ ${formatMoney(usdPreview, 4)} · курс {formatMoney(Number(rate), 6)}
          </span>
        ) : null}
        <button type="submit" className="ui-btn ui-btn-primary">
          Погасити
        </button>
      </form>
    </li>
  );
}

export function CounterpartyDetailClient({
  counterparty,
  operations,
  debts,
  canManage,
  canCreate,
  opForm,
}: {
  counterparty: {
    id: string;
    name: string;
    phone: string | null;
    telegram: string | null;
    note: string | null;
    temporary: boolean;
  };
  operations: {
    id: string;
    type: TransactionType;
    note: string | null;
    rate: number | null;
    createdAt: string;
    createdByName: string;
    archived: boolean;
    legs: { walletName: string; amount: number }[];
  }[];
  debts: Debt[];
  canManage: boolean;
  canCreate: boolean;
  opForm: OpFormData;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const list = useClientList({
    items: operations,
    getSearchValues: (op) => [
      op.note,
      TRANSACTION_TYPE_LABELS[op.type],
      op.createdByName,
    ],
    getSortValue: (op, key) => {
      if (key === "date") return new Date(op.createdAt);
      return op.createdAt;
    },
    initialSort: "date",
    initialDir: "desc",
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={counterparty.name}
        description={
          counterparty.temporary ? "Тимчасовий контрагент" : "Постійний контрагент"
        }
        actions={
          canCreate ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="ui-btn ui-btn-primary"
            >
              <Plus size={16} weight="bold" />
              Операція
            </button>
          ) : null
        }
      />

      {canManage ? (
        <Panel className="p-4">
          <form action={updateCounterpartyAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="id" value={counterparty.id} />
            <input
              name="name"
              defaultValue={counterparty.name}
              required
              className="ui-input"
            />
            <input
              name="phone"
              defaultValue={counterparty.phone ?? ""}
              placeholder="Телефон"
              className="ui-input"
            />
            <input
              name="telegram"
              defaultValue={counterparty.telegram ?? ""}
              placeholder="Telegram"
              className="ui-input"
            />
            <input
              name="note"
              defaultValue={counterparty.note ?? ""}
              placeholder="Примітка"
              className="ui-input min-w-[12rem] flex-1"
            />
            <button type="submit" className="ui-btn ui-btn-secondary">
              Зберегти
            </button>
            {counterparty.temporary ? (
              <button
                type="submit"
                formAction={promoteCounterpartyAction}
                className="ui-btn ui-btn-primary"
              >
                Зробити постійним
              </button>
            ) : null}
          </form>
        </Panel>
      ) : (
        <Panel className="p-4 text-[13px] text-text-muted">
          {[counterparty.phone, counterparty.telegram, counterparty.note]
            .filter(Boolean)
            .join(" · ") || "Без контактів"}
        </Panel>
      )}

      {debts.length > 0 ? (
        <Panel className="p-4">
          <h2 className="mb-3 text-sm font-medium text-text">Відкриті борги</h2>
          <ul className="space-y-2">
            {debts.map((d) => (
              <DebtRepayRow
                key={d.id}
                debt={d}
                canCreate={canCreate}
                suggestedRate={opForm.lastRates?.[d.walletId] ?? null}
              />
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium text-text">Історія операцій</h2>
        </div>
        <ListToolbar
          q={list.q}
          onSearch={list.setSearch}
          pageSize={list.pageSize}
          onPageSize={list.setPageSize}
        />
        <div className="overflow-x-auto">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тип</th>
                <th>Каси</th>
                <th className="text-right">Курс</th>
                <th>Автор</th>
              </tr>
            </thead>
            <tbody>
              {list.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-text-muted">
                    Операцій немає
                  </td>
                </tr>
              ) : (
                list.pageItems.map((op) => (
                  <tr key={op.id} className={op.archived ? "opacity-60" : ""}>
                    <td className="text-[12px] text-text-muted">
                      {formatDateTime(op.createdAt)}
                    </td>
                    <td>
                      <span className="ui-badge ui-badge-accent">
                        {TRANSACTION_TYPE_LABELS[op.type]}
                      </span>
                    </td>
                    <td className="text-[12px] font-mono-num">
                      {op.legs.map((l, i) => (
                        <span key={i}>
                          {l.walletName}: {formatMoney(l.amount)}
                          {i < op.legs.length - 1 ? "; " : ""}
                        </span>
                      ))}
                    </td>
                    <td className="text-right font-mono-num text-[12px]">
                      {op.rate != null ? formatMoney(op.rate, 4) : "—"}
                    </td>
                    <td className="text-[12px] text-text-muted">
                      {op.createdByName}
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

      <Link
        href="/counterparties"
        className="inline-block text-[13px] text-accent hover:underline"
      >
        Назад до списку
      </Link>

      <NewOperationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        opForm={opForm}
        defaultCounterpartyId={counterparty.id}
      />
    </div>
  );
}
