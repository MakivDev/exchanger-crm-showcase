"use client";

import Link from "next/link";
import { formatMoney, formatSignedMoney } from "@/lib/format";
import {
  TRANSACTION_TYPE_LABELS,
  type TransactionType,
} from "@/lib/types/domain";

export type JournalRow = {
  id: string;
  type: string;
  counterpartyId?: string;
  counterpartyLabel: string;
  cells: { walletId: string; amount: number }[];
  fromWalletId?: string;
  toWalletId?: string;
  debtWalletId?: string;
  rate?: number;
  profit?: number;
  note?: string;
  inputAmount?: number;
  outputAmount?: number;
  createdByName: string;
  createdAt: string;
  wasEdited?: boolean;
};

export type JournalData = {
  date: string;
  branchName: string;
  wallets: {
    id: string;
    name: string;
    color: string;
    currencyCode: string;
  }[];
  opening: Record<string, number>;
  closing: Record<string, number>;
  rows: JournalRow[];
};

function cellAmount(row: JournalRow, walletId: string) {
  return row.cells.find((c) => c.walletId === walletId)?.amount;
}

function operationSummary(row: JournalRow) {
  const parts: string[] = [];
  if (row.type in TRANSACTION_TYPE_LABELS) {
    parts.push(TRANSACTION_TYPE_LABELS[row.type as TransactionType]);
  }
  if (row.rate != null && row.inputAmount != null) {
    parts.push(
      `${formatMoney(row.inputAmount)} @ ${formatMoney(row.rate, 4)} → $${formatMoney(row.inputAmount / row.rate, 4)}`,
    );
  }
  if (row.profit != null) {
    parts.push(`приб. ${formatMoney(row.profit)}`);
  }
  if (row.note) parts.push(row.note);
  return parts.join(" · ") || "—";
}

function CounterpartyCell({ row }: { row: JournalRow }) {
  if (row.counterpartyId) {
    return (
      <Link
        href={`/counterparties/${row.counterpartyId}`}
        className="font-medium text-text hover:text-accent"
      >
        {row.counterpartyLabel}
      </Link>
    );
  }
  return <span>{row.counterpartyLabel}</span>;
}

export function DayJournal({
  data,
  onEdit,
  canEdit,
}: {
  data: JournalData;
  onEdit?: (row: JournalRow) => void;
  canEdit?: boolean;
}) {
  const { wallets, opening, closing, rows } = data;

  return (
    <div className="overflow-hidden">
      <div className="max-h-[calc(100dvh-10rem)] overflow-auto">
        <table className="ui-table min-w-[640px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="min-w-[10rem]">Контрагент</th>
              <th className="min-w-[14rem]">Операція</th>
              {wallets.map((w) => (
                <th key={w.id} className="text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: w.color }}
                    />
                    {w.name}
                  </span>
                </th>
              ))}
              {canEdit ? <th className="w-16" /> : null}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-surface-2/60">
              <td colSpan={2} className="text-[12px] font-medium text-text-muted">
                Початок дня
              </td>
              {wallets.map((w) => (
                <td key={w.id} className="text-right font-mono-num text-[12px]">
                  {formatMoney(opening[w.id] ?? 0)}
                </td>
              ))}
              {canEdit ? <td /> : null}
            </tr>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={wallets.length + 2 + (canEdit ? 1 : 0)}
                  className="py-8 text-center text-text-muted"
                >
                  Операцій за цей день немає
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <CounterpartyCell row={row} />
                    {row.wasEdited ? (
                      <span className="ml-1 ui-badge">ред.</span>
                    ) : null}
                  </td>
                  <td className="text-[12px] text-text-muted">
                    {operationSummary(row)}
                  </td>
                  {wallets.map((w) => {
                    const amt = cellAmount(row, w.id);
                    return (
                      <td
                        key={w.id}
                        className={`text-right font-mono-num text-[13px] ${
                          amt != null && amt < 0
                            ? "text-danger"
                            : amt != null && amt > 0
                              ? "text-success"
                              : ""
                        }`}
                      >
                        {amt != null ? formatSignedMoney(amt) : "—"}
                      </td>
                    );
                  })}
                  {canEdit ? (
                    <td>
                      <button
                        type="button"
                        onClick={() => onEdit?.(row)}
                        className="ui-btn ui-btn-ghost h-7 px-2 text-[12px]"
                      >
                        Ред.
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
            <tr className="bg-surface-2/60 font-medium">
              <td colSpan={2} className="text-[12px] text-text-muted">
                Кінець дня
              </td>
              {wallets.map((w) => (
                <td key={w.id} className="text-right font-mono-num text-[13px]">
                  {formatMoney(closing[w.id] ?? 0)}
                </td>
              ))}
              {canEdit ? <td /> : null}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
