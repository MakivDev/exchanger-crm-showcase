"use client";

import { CaretDown, CaretUp } from "@phosphor-icons/react";
import type { SortDir } from "@/lib/list/utils";

export function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  dir: SortDir;
  onSort: (key: string) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 text-[11px] font-medium tracking-wide text-text-muted uppercase hover:text-text"
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <CaretUp size={11} weight="bold" className="text-accent" />
        ) : (
          <CaretDown size={11} weight="bold" className="text-accent" />
        )
      ) : null}
    </button>
  );
}
