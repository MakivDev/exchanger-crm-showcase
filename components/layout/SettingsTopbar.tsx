"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Permission } from "@/lib/types/domain";
import { canSeeNav } from "@/lib/auth/access";

const tabs: {
  href: string;
  label: string;
  exact?: boolean;
  anyOf?: Permission[];
}[] = [
  { href: "/settings", label: "Загальні", exact: true },
  {
    href: "/settings/users",
    label: "Користувачі",
    anyOf: ["manage_users"],
  },
  {
    href: "/settings/directories",
    label: "Довідники",
    anyOf: ["manage_directories"],
  },
  {
    href: "/settings/audit",
    label: "Аудит",
    anyOf: ["view_audit"],
  },
];

export function SettingsTopbar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const visible = tabs.filter((t) => canSeeNav({ permissions }, t.anyOf));

  return (
    <div className="border-b border-border bg-surface">
      <div className="px-3 pt-4 pb-1 sm:px-5">
        <h1 className="text-[17px] font-semibold tracking-tight">Налаштування</h1>
      </div>
      <div className="flex gap-1 overflow-x-auto px-3 pb-2 sm:px-5">
        {visible.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 rounded-[var(--radius)] px-3 py-1.5 text-[13px] ${
                active
                  ? "bg-accent text-accent-fg"
                  : "text-text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
