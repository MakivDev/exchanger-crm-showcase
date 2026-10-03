"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CaretDown, SignOut } from "@phosphor-icons/react";
import { setBranchAction } from "@/lib/actions/branch";
import { logoutAction } from "@/lib/actions/auth";

type BranchOption = { id: string; name: string };

export function BranchSwitcher({
  branches,
  currentBranchId,
}: {
  branches: BranchOption[];
  currentBranchId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current =
    branches.find((b) => b.id === currentBranchId) ?? branches[0] ?? null;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!current) {
    return <p className="text-[13px] text-text-muted">Немає точок</p>;
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-0 items-center gap-1 rounded-[var(--radius)] px-1.5 py-1 text-left hover:bg-surface-2"
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-text">
          {current.name}
        </span>
        <CaretDown
          size={12}
          className={`shrink-0 text-text-muted ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <ul className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-[var(--radius)] border border-border bg-surface py-1 shadow-[0_8px_24px_var(--shadow)]">
          {branches.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-[13px] ${
                  b.id === current.id
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-text hover:bg-surface-2"
                }`}
                onClick={() => {
                  setOpen(false);
                  if (b.id === current.id) return;
                  start(async () => {
                    await setBranchAction(b.id);
                    router.refresh();
                  });
                }}
              >
                {b.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="ui-btn ui-btn-ghost w-full justify-start">
        <SignOut size={16} />
        Вийти
      </button>
    </form>
  );
}
