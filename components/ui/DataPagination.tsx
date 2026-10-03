"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { PageSize } from "@/lib/list/utils";

export function DataPagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: PageSize;
  onPage: (page: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-2 border-t border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-mono-num text-[12px] text-text-muted">
        {from}–{to} / {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="ui-btn ui-btn-secondary h-8 px-2"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <CaretLeft size={14} />
        </button>
        <span className="px-2 font-mono-num text-[12px] text-text-muted">
          {page}/{pageCount}
        </span>
        <button
          type="button"
          className="ui-btn ui-btn-secondary h-8 px-2"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          <CaretRight size={14} />
        </button>
      </div>
    </div>
  );
}
