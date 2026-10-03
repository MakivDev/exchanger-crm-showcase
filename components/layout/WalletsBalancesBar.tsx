import Link from "next/link";
import type { CSSProperties } from "react";
import { formatMoney } from "@/lib/format";

export type WalletBalanceItem = {
  id: string;
  name: string;
  color: string;
  balance: number;
  currencyCode: string;
};

function walletChipStyle(color: string): CSSProperties {
  return {
    background: `linear-gradient(
      145deg,
      color-mix(in oklab, ${color} 22%, var(--surface)) 0%,
      color-mix(in oklab, ${color} 10%, var(--bg)) 55%,
      color-mix(in oklab, ${color} 6%, var(--surface)) 100%
    )`,
    borderColor: `color-mix(in oklab, ${color} 32%, var(--border))`,
    boxShadow: `inset 3px 0 0 0 color-mix(in oklab, ${color} 75%, transparent)`,
  };
}

export function WalletsBalancesBar({
  wallets,
}: {
  wallets: WalletBalanceItem[];
}) {
  if (wallets.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-border bg-surface">
      <div className="flex gap-2 overflow-x-auto px-3 py-2 sm:px-5">
        {wallets.map((w) => (
          <Link
            key={w.id}
            href="/wallets"
            style={walletChipStyle(w.color)}
            className="group flex shrink-0 items-baseline gap-2 rounded-[var(--radius)] border px-3 py-1.5 pl-3.5 transition-[filter,transform] hover:brightness-[1.03] hover:saturate-110 active:scale-[0.99] dark:hover:brightness-110"
            title={`${w.name} · ${w.currencyCode}`}
          >
            <span className="max-w-[7.5rem] truncate text-[12px] text-text-muted">
              {w.name}
            </span>
            <span className="font-mono-num text-[13px] font-semibold tracking-tight text-text">
              {formatMoney(w.balance)}
              <span className="ml-1 text-[11px] font-medium text-text-muted">
                {w.currencyCode}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
