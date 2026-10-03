"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Buildings,
  ClockCounterClockwise,
  GearSix,
  List,
  UsersThree,
  Wallet,
  X,
} from "@phosphor-icons/react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  BranchSwitcher,
  LogoutButton,
} from "@/components/layout/BranchSelect";
import type { Permission } from "@/lib/types/domain";
import { canSeeNav } from "@/lib/auth/access";

const navItems: {
  href: string;
  label: string;
  match: string;
  icon: typeof Buildings;
  anyOf?: Permission[];
}[] = [
  {
    href: "/work/journal",
    label: "Робоча зона",
    match: "/work",
    icon: Buildings,
    anyOf: ["view_operations", "create_operation"],
  },
  {
    href: "/history",
    label: "Історія",
    match: "/history",
    icon: ClockCounterClockwise,
    anyOf: [
      "view_operations",
      "create_operation",
      "archive_operation",
      "delete_operation",
    ],
  },
  {
    href: "/counterparties",
    label: "Контрагенти",
    match: "/counterparties",
    icon: UsersThree,
    anyOf: ["view_all_wallets", "manage_directories"],
  },
  {
    href: "/wallets",
    label: "Каси",
    match: "/wallets",
    icon: Wallet,
    anyOf: [
      "view_all_wallets",
      "manage_directories",
      "edit_opening_balance",
    ],
  },
  {
    href: "/notifications",
    label: "Сповіщення",
    match: "/notifications",
    icon: Bell,
  },
  {
    href: "/settings",
    label: "Налаштування",
    match: "/settings",
    icon: GearSix,
  },
];

export function Sidebar({
  branches,
  currentBranchId,
  userName,
  unreadCount,
  permissions,
}: {
  branches: { id: string; name: string }[];
  currentBranchId: string | null;
  userName: string;
  unreadCount: number;
  permissions: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const user = { permissions };
  const visible = navItems.filter((item) => canSeeNav(user, item.anyOf));

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3">
      {visible.map((item) => {
        const active = pathname.startsWith(item.match);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2.5 rounded-[var(--radius)] px-2.5 py-2 text-[13px] transition ${
              active
                ? "bg-accent-soft font-medium text-accent"
                : "text-text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            <Icon size={16} weight={active ? "fill" : "regular"} />
            <span className="flex-1">{item.label}</span>
            {item.match === "/notifications" && unreadCount > 0 ? (
              <span className="rounded bg-accent px-1.5 font-mono-num text-[10px] text-accent-fg">
                {unreadCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-surface px-3 py-2 lg:hidden">
        <div className="min-w-0 flex-1">
          <BranchSwitcher
            branches={branches}
            currentBranchId={currentBranchId}
          />
          <p className="truncate px-1.5 text-[11px] text-text-muted">
            {userName}
          </p>
        </div>
        <ThemeToggle />
        <button
          type="button"
          className="ui-btn ui-btn-secondary h-8 w-8 p-0"
          onClick={() => setOpen(true)}
          aria-label="Меню"
        >
          <List size={18} />
        </button>
      </div>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Закрити"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-w)] flex-col border-r border-border bg-surface transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start gap-2 border-b border-border px-2.5 py-3">
          <div className="min-w-0 flex-1">
            <BranchSwitcher
              branches={branches}
              currentBranchId={currentBranchId}
            />
            <p className="mt-0.5 truncate px-1.5 text-[11px] text-text-muted">
              {userName}
            </p>
          </div>
          <div className="hidden pt-0.5 lg:block">
            <ThemeToggle />
          </div>
          <div className="pt-0.5 lg:hidden">
            <button
              type="button"
              className="ui-btn ui-btn-secondary h-8 w-8 p-0"
              onClick={() => setOpen(false)}
              aria-label="Закрити меню"
            >
              <X size={14} />
            </button>
          </div>
        </div>
        {nav}
        <div className="border-t border-border p-2">
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
