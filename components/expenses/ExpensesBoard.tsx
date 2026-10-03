"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { DataPagination } from "@/components/ui/DataPagination";
import { SortHeader } from "@/components/ui/SortHeader";
import { useClientList } from "@/lib/list/use-client-list";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  NewOperationModal,
  type OpFormData,
} from "@/components/operations/NewOperationModal";

export type ExpenseOperation = {
  id: string;
  amount: number;
  rate: number | null;
  usdAmount: number | null;
  note: string | null;
  categoryName: string | null;
  walletName: string;
  createdByName: string;
  createdAt: string;
};

export function ExpensesBoard({
  operations,
  canCreate,
  opForm,
}: {
  operations: ExpenseOperation[];
  canCreate: boolean;
  opForm: OpFormData;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const list = useClientList({
    items: operations,
    getSearchValues: (op) => [
      op.note,
      op.categoryName,
      op.walletName,
      op.createdByName,
    ],
    getSortValue: (op, key) => {
      if (key === "date") return new Date(op.createdAt);
      if (key === "amount") return op.amount;
      if (key === "category") return op.categoryName ?? "";
      return op.createdAt;
    },
    initialSort: "date",
    initialDir: "desc",
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Витрати"
        description="Операції типу «Витрата» за обраною точкою"
        actions={
          canCreate ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="ui-btn ui-btn-primary"
            >
              <Plus size={16} weight="bold" />
              Нова витрата
            </button>
          ) : null
        }
      />

      <Panel className="overflow-hidden p-0">
        <ListToolbar
          q={list.q}
          onSearch={list.setSearch}
          pageSize={list.pageSize}
          onPageSize={list.setPageSize}
          searchPlaceholder="Пошук витрат…"
        />

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
                    label="Категорія"
                    sortKey="category"
                    activeKey={list.sort}
                    dir={list.dir}
                    onSort={list.changeSort}
                  />
                </th>
                <th>Каса</th>
                <th className="text-right">
                  <SortHeader
                    label="Сума"
                    sortKey="amount"
                    activeKey={list.sort}
                    dir={list.dir}
                    onSort={list.changeSort}
                  />
                </th>
                <th className="text-right">Курс</th>
                <th className="text-right">USD</th>
                <th>Автор</th>
              </tr>
            </thead>
            <tbody>
              {list.pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-muted">
                    Витрат немає
                  </td>
                </tr>
              ) : (
                list.pageItems.map((op) => (
                  <tr key={op.id}>
                    <td className="whitespace-nowrap text-[12px] text-text-muted">
                      {formatDateTime(op.createdAt)}
                    </td>
                    <td>{op.categoryName ?? "—"}</td>
                    <td className="text-[13px]">{op.walletName}</td>
                    <td className="text-right font-mono-num text-danger">
                      −{formatMoney(op.amount)}
                    </td>
                    <td className="text-right font-mono-num text-[12px]">
                      {op.rate != null ? formatMoney(op.rate, 4) : "—"}
                    </td>
                    <td className="text-right font-mono-num text-[12px]">
                      {op.usdAmount != null
                        ? `$${formatMoney(op.usdAmount, 4)}`
                        : "—"}
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

      <NewOperationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        opForm={opForm}
        defaultType="expense"
      />
    </div>
  );
}
