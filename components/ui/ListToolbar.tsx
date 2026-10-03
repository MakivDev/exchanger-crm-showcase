"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { PAGE_SIZES, type PageSize } from "@/lib/list/utils";

export function ListToolbar({
  q,
  onSearch,
  pageSize,
  onPageSize,
  children,
  searchPlaceholder = "Пошук…",
}: {
  q: string;
  onSearch: (value: string) => void;
  pageSize: PageSize;
  onPageSize: (size: PageSize) => void;
  children?: React.ReactNode;
  searchPlaceholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      <label className="relative min-w-[14rem] flex-1">
        <MagnifyingGlass
          size={14}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-muted"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="ui-input pl-8"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <label className="flex items-center gap-1.5 text-[12px] text-text-muted">
          Рядків
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value) as PageSize)}
            className="ui-input w-auto"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
