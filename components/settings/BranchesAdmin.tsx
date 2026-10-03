"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Panel } from "@/components/ui/Panel";
import {
  activateBranchAction,
  createBranchAction,
  deactivateBranchAction,
  deleteBranchAction,
  updateBranchAction,
} from "@/lib/actions/branch";

type Branch = {
  id: string;
  name: string;
  isActive: boolean;
};

export function BranchesAdmin({
  branches,
  canManage,
}: {
  branches: Branch[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function confirmDeactivate(id: string, name: string) {
    if (!window.confirm(`Деактивувати точку «${name}»?`)) return;
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await deactivateBranchAction(fd);
      router.refresh();
    });
  }

  function confirmDelete(id: string, name: string) {
    if (!window.confirm(`Видалити точку «${name}»? Це остаточно.`)) return;
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const result = await deleteBranchAction(fd);
      if (!result.ok) {
        window.alert(result.error ?? "Помилка видалення");
        return;
      }
      router.refresh();
    });
  }

  function activate(id: string) {
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await activateBranchAction(fd);
      router.refresh();
    });
  }

  return (
    <Panel className="p-4 sm:p-5">
      <h2 className="font-medium text-text">Точки обміну</h2>
      <p className="mt-1 text-[13px] text-text-muted">
        Активні точки доступні в перемикачі. Неактивні можна знову активувати.
      </p>

      <ul className="mt-4 divide-y divide-border">
        {branches.map((b) => (
          <li key={b.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              {canManage ? (
                <form
                  action={updateBranchAction}
                  className="flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="id" value={b.id} />
                  <input
                    name="name"
                    defaultValue={b.name}
                    required
                    className="ui-input max-w-xs"
                  />
                  <button type="submit" className="ui-btn ui-btn-ghost h-8 text-[12px]">
                    Зберегти
                  </button>
                </form>
              ) : (
                <span className="font-medium">{b.name}</span>
              )}
              <span
                className={`ml-2 ui-badge ${b.isActive ? "ui-badge-accent" : ""}`}
              >
                {b.isActive ? "активна" : "неактивна"}
              </span>
            </div>
            {canManage ? (
              <div className="flex flex-wrap gap-2">
                {!b.isActive ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => activate(b.id)}
                    className="ui-btn ui-btn-primary h-8 text-[12px]"
                  >
                    Активувати
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => confirmDeactivate(b.id, b.name)}
                    className="ui-btn ui-btn-secondary h-8 text-[12px]"
                  >
                    Деактивувати
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => confirmDelete(b.id, b.name)}
                  className="ui-btn ui-btn-danger h-8 text-[12px]"
                >
                  Видалити
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {canManage ? (
        <form action={createBranchAction} className="mt-4 flex flex-wrap gap-2">
          <input
            name="name"
            required
            placeholder="Назва нової точки"
            className="ui-input max-w-xs"
          />
          <button type="submit" className="ui-btn ui-btn-primary">
            Додати точку
          </button>
        </form>
      ) : null}
    </Panel>
  );
}
