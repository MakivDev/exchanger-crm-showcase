"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, Fragment } from "react";
import { CaretDown, CaretRight, Plus } from "@phosphor-icons/react";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { DataPagination } from "@/components/ui/DataPagination";
import { SortHeader } from "@/components/ui/SortHeader";
import { DatePicker, DateRangePicker } from "@/components/ui/DatePicker";
import {
  NewOperationModal,
  type OpFormData,
} from "@/components/operations/NewOperationModal";
import { useClientList } from "@/lib/list/use-client-list";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatSignedMoney,
} from "@/lib/format";
import {
  HISTORY_CREATE_TYPES,
  HISTORY_EDIT_TYPES,
  TRANSACTION_TYPE_LABELS,
  type TransactionType,
} from "@/lib/types/domain";
import { HistoryActions } from "@/components/history/HistoryActions";
import { HistoryEditModal } from "@/components/history/HistoryEditModal";
import { HistoryRowDetails } from "@/components/history/HistoryRowDetails";

const ALL_TYPES: TransactionType[] = [
  "buy",
  "sell",
  "lend",
  "repay",
  "recolor",
  "expense",
  "adjustment",
  "exchange",
  "cash_in",
  "cash_out",
  "balance_transfer",
];

export type HistoryOperation = {
  id: string;
  type: TransactionType;
  archived: boolean;
  archiveComment: string | null;
  note: string | null;
  rate: number | null;
  profit: number | null;
  counterpartyId: string | null;
  counterpartyLabel: string;
  expenseCategoryId: string | null;
  createdByName: string;
  createdAt: string;
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
    rateUsd: number | null;
  }[];
};

export function HistoryBoard({
  operations,
  canArchive,
  canDelete,
  canCreate,
  opForm,
  initialType,
  initialArchived,
  dateFrom,
  dateTo,
  isRange,
}: {
  operations: HistoryOperation[];
  canArchive: boolean;
  canDelete: boolean;
  canCreate?: boolean;
  opForm?: OpFormData | null;
  initialType?: TransactionType;
  initialArchived?: boolean;
  dateFrom: string;
  dateTo: string;
  isRange: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"day" | "range">(isRange ? "range" : "day");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOp, setEditOp] = useState<HistoryOperation | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setMode(isRange ? "range" : "day");
  }, [isRange]);

  const filteredByMeta = operations.filter((op) => {
    if (initialArchived) return true;
    return !op.archived;
  });

  const typeFiltered = initialType
    ? filteredByMeta.filter((op) => op.type === initialType)
    : filteredByMeta;

  const list = useClientList({
    items: typeFiltered,
    getSearchValues: (op) => [
      op.counterpartyLabel,
      op.note,
      TRANSACTION_TYPE_LABELS[op.type],
      op.createdByName,
      ...op.legs.map((l) => l.walletName),
    ],
    getSortValue: (op, key) => {
      if (key === "date") return new Date(op.createdAt);
      if (key === "type") return TRANSACTION_TYPE_LABELS[op.type];
      if (key === "counterparty") return op.counterpartyLabel;
      return op.createdAt;
    },
    initialSort: "date",
    initialDir: "desc",
  });

  function pushFilter(opts: {
    type?: string;
    archived?: boolean;
    date?: string;
    from?: string;
    to?: string;
  }) {
    const qs = new URLSearchParams();
    const type = opts.type ?? initialType ?? "";
    const archived = opts.archived ?? !!initialArchived;
    if (type) qs.set("type", type);
    if (archived) qs.set("archived", "1");

    if (opts.from && opts.to) {
      const a = opts.from <= opts.to ? opts.from : opts.to;
      const b = opts.from <= opts.to ? opts.to : opts.from;
      qs.set("from", a);
      qs.set("to", b);
    } else if (opts.date) {
      qs.set("date", opts.date);
    } else if (isRange) {
      qs.set("from", dateFrom);
      qs.set("to", dateTo);
    } else {
      qs.set("date", dateFrom);
    }

    router.push(`/history?${qs.toString()}`);
  }

  function goDay(iso: string) {
    pushFilter({ date: iso });
  }

  function goRange(from: string, to: string) {
    pushFilter({ from, to });
  }

  const description = isRange
    ? `${formatDate(dateFrom)} – ${formatDate(dateTo)} · усі типи операцій обраної точки`
    : `${formatDate(dateFrom)} · усі типи операцій обраної точки`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Історія операцій"
        description={description}
        actions={
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
                  if (isRange) goDay(dateTo);
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
              <DatePicker value={dateFrom} onChange={goDay} />
            ) : (
              <DateRangePicker
                from={dateFrom}
                to={dateTo}
                onChange={({ from, to }) => goRange(from, to)}
              />
            )}
            {canCreate && opForm ? (
              <button
                type="button"
                className="ui-btn ui-btn-primary h-8"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={14} weight="bold" />
                Нова операція
              </button>
            ) : null}
          </div>
        }
      />

      <Panel className="overflow-hidden p-0">
        <ListToolbar
          q={list.q}
          onSearch={list.setSearch}
          pageSize={list.pageSize}
          onPageSize={list.setPageSize}
        >
          <select
            value={initialType ?? ""}
            onChange={(e) =>
              pushFilter({ type: e.target.value, archived: !!initialArchived })
            }
            className="ui-input w-auto"
          >
            <option value="">Усі типи</option>
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {TRANSACTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-[12px] text-text-muted">
            <input
              type="checkbox"
              checked={!!initialArchived}
              onChange={(e) =>
                pushFilter({
                  type: initialType ?? "",
                  archived: e.target.checked,
                })
              }
            />
            Архів
          </label>
        </ListToolbar>

        <div className="overflow-x-auto">
          <table className="ui-table">
            <thead>
              <tr>
                <th>
                  <SortHeader
                    label="Дата"
                    sortKey="date"
                    activeKey={list.sort}
                    dir={list.dir}
                    onSort={list.changeSort}
                  />
                </th>
                <th>
                  <SortHeader
                    label="Тип"
                    sortKey="type"
                    activeKey={list.sort}
                    dir={list.dir}
                    onSort={list.changeSort}
                  />
                </th>
                <th>
                  <SortHeader
                    label="Контрагент"
                    sortKey="counterparty"
                    activeKey={list.sort}
                    dir={list.dir}
                    onSort={list.changeSort}
                  />
                </th>
                <th>Каси</th>
                <th className="text-right">Курс</th>
                <th>Автор</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-muted">
                    Записів немає
                  </td>
                </tr>
              ) : (
                list.pageItems.map((op) => {
                  const expanded = expandedId === op.id;
                  return (
                    <Fragment key={op.id}>
                      <tr
                        className={`cursor-pointer transition hover:bg-surface-2/70 ${
                          op.archived ? "opacity-60" : ""
                        } ${expanded ? "bg-surface-2/50" : ""}`}
                        onClick={() =>
                          setExpandedId((id) => (id === op.id ? null : op.id))
                        }
                      >
                        <td className="whitespace-nowrap text-[12px] text-text-muted">
                          <span className="mr-1 inline-flex text-text-muted">
                            {expanded ? (
                              <CaretDown size={12} />
                            ) : (
                              <CaretRight size={12} />
                            )}
                          </span>
                          {formatDateTime(op.createdAt)}
                        </td>
                        <td>
                          <span
                            className={
                              op.archived
                                ? "ui-badge"
                                : "ui-badge ui-badge-accent"
                            }
                          >
                            {TRANSACTION_TYPE_LABELS[op.type]}
                          </span>
                        </td>
                        <td>
                          {op.counterpartyId ? (
                            <Link
                              href={`/counterparties/${op.counterpartyId}`}
                              className="hover:text-accent"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {op.counterpartyLabel}
                            </Link>
                          ) : op.type === "cash_in" ||
                            op.type === "cash_out" ||
                            op.type === "recolor" ||
                            op.type === "adjustment" ? (
                            <span className="text-text-muted">—</span>
                          ) : (
                            op.counterpartyLabel
                          )}
                          {op.note ? (
                            <p className="mt-0.5 text-[12px] text-text-muted">
                              {op.note}
                            </p>
                          ) : null}
                          {op.archived && op.archiveComment ? (
                            <p className="mt-0.5 text-[12px] text-warning">
                              {op.archiveComment}
                            </p>
                          ) : null}
                        </td>
                        <td className="text-[12px]">
                          {op.legs.map((l) => (
                            <div
                              key={l.id}
                              className="flex flex-wrap items-baseline gap-x-2 font-mono-num"
                            >
                              <span className="font-sans text-text">
                                {l.walletName}:
                              </span>
                              <span
                                className={
                                  l.amount < 0
                                    ? "text-danger"
                                    : l.amount > 0
                                      ? "text-success"
                                      : ""
                                }
                              >
                                {formatSignedMoney(l.amount)}
                              </span>
                            </div>
                          ))}
                        </td>
                        <td className="text-right font-mono-num text-[12px]">
                          {op.type === "exchange" || op.legs.length > 2
                            ? "—"
                            : op.rate != null
                              ? formatMoney(op.rate, 4)
                              : "—"}
                        </td>
                        <td className="text-[12px] text-text-muted">
                          {op.createdByName}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <HistoryActions
                            id={op.id}
                            archived={op.archived}
                            canArchive={canArchive}
                            canDelete={canDelete}
                            canEdit={
                              Boolean(canCreate && opForm) &&
                              !op.archived &&
                              HISTORY_EDIT_TYPES.includes(op.type)
                            }
                            onEdit={() => setEditOp(op)}
                          />
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="bg-bg/40">
                          <td colSpan={7} className="p-0">
                            <HistoryRowDetails operation={op} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
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

      {canCreate && opForm ? (
        <NewOperationModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          opForm={opForm}
          defaultType="buy"
          defaultDate={isRange ? dateTo : dateFrom}
          allowedTypes={HISTORY_CREATE_TYPES}
          title="Операція (історія)"
        />
      ) : null}

      {editOp && opForm ? (
        <HistoryEditModal
          operation={editOp}
          wallets={opForm.wallets}
          counterparties={opForm.counterparties}
          expenseCategories={opForm.expenseCategories ?? []}
          onClose={() => setEditOp(null)}
        />
      ) : null}
    </div>
  );
}
