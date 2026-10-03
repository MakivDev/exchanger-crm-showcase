"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Panel } from "@/components/ui/Panel";
import {
  applyPresetToUserAction,
  checkUserDeletableAction,
  createUserAction,
  deleteUserAction,
  setUserActiveAction,
  setUserPermissionsAction,
  updateUserAction,
} from "@/lib/actions/users";
import { PERMISSION_LABELS, type Permission } from "@/lib/types/domain";

type UserRow = {
  id: string;
  login: string;
  name: string;
  isActive: boolean;
  permissionCodes: string[];
};

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

export function UsersAdmin({
  currentUserId,
  users,
  presets,
}: {
  currentUserId: string;
  users: UserRow[];
  presets: { name: string; codes: string[] }[];
}) {
  const router = useRouter();
  const createFormRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const form = e.currentTarget;
    const fd = new FormData(form);

    start(async () => {
      const result = await createUserAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Користувача створено");
      form.reset();
      router.refresh();
    });
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    start(async () => {
      const result = await updateUserAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditingId(null);
      setMessage("Збережено");
      router.refresh();
    });
  }

  async function toggleActive(userId: string, isActive: boolean) {
    start(async () => {
      const result = await setUserActiveAction(userId, !isActive);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  async function savePermissions(userId: string, codes: string[]) {
    start(async () => {
      await setUserPermissionsAction(userId, codes);
      router.refresh();
    });
  }

  async function applyPreset(userId: string, presetName: string) {
    start(async () => {
      const result = await applyPresetToUserAction(userId, presetName);
      if (!result.ok) {
        setError(result.error ?? "Помилка пресету");
        return;
      }
      router.refresh();
    });
  }

  async function tryDelete(userId: string) {
    start(async () => {
      const check = await checkUserDeletableAction(userId);
      if (!window.confirm(check.message)) return;
      if (!check.canDelete) return;

      const result = await deleteUserAction(userId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Користувача видалено");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Panel className="p-4 sm:p-5">
        <h2 className="font-medium text-text">Новий користувач</h2>
        <form
          ref={createFormRef}
          onSubmit={handleCreate}
          className="mt-3 flex flex-wrap gap-2"
        >
          <input name="login" required placeholder="Логін" className="ui-input w-32" />
          <input name="name" required placeholder="Ім'я" className="ui-input" />
          <input
            name="password"
            type="password"
            required
            minLength={4}
            placeholder="Пароль"
            className="ui-input w-36"
          />
          <button type="submit" disabled={pending} className="ui-btn ui-btn-primary">
            Створити
          </button>
        </form>
        {message ? (
          <p className="mt-2 text-[13px] text-success">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-2 text-[13px] text-danger">{error}</p>
        ) : null}
      </Panel>

      <Panel className="overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {users.map((u) => (
            <li key={u.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-text">
                    {u.name}{" "}
                    <span className="text-[13px] font-normal text-text-muted">
                      ({u.login})
                    </span>
                  </p>
                  <span className={`ui-badge ${u.isActive ? "ui-badge-accent" : ""}`}>
                    {u.isActive ? "активний" : "неактивний"}
                  </span>
                  {u.id === currentUserId ? (
                    <span className="ml-1 ui-badge">ви</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending || u.id === currentUserId}
                    onClick={() => toggleActive(u.id, u.isActive)}
                    className="ui-btn ui-btn-secondary h-8 text-[12px]"
                  >
                    {u.isActive ? "Деактивувати" : "Активувати"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingId(editingId === u.id ? null : u.id)
                    }
                    className="ui-btn ui-btn-ghost h-8 text-[12px]"
                  >
                    {editingId === u.id ? "Згорнути" : "Редагувати"}
                  </button>
                  <button
                    type="button"
                    disabled={pending || u.id === currentUserId}
                    onClick={() => tryDelete(u.id)}
                    className="ui-btn ui-btn-danger h-8 text-[12px]"
                  >
                    Видалити
                  </button>
                </div>
              </div>

              {editingId === u.id ? (
                <form onSubmit={handleUpdate} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="userId" value={u.id} />
                  <input
                    name="login"
                    defaultValue={u.login}
                    required
                    className="ui-input w-32"
                  />
                  <input
                    name="name"
                    defaultValue={u.name}
                    required
                    className="ui-input"
                  />
                  <input
                    name="password"
                    type="password"
                    placeholder="Новий пароль (необов.)"
                    className="ui-input w-40"
                  />
                  <button type="submit" className="ui-btn ui-btn-primary h-[34px]">
                    Зберегти профіль
                  </button>
                </form>
              ) : null}

              <div className="mt-3">
                <p className="mb-2 text-[12px] font-medium text-text-muted">
                  Дозволи
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {ALL_PERMISSIONS.map((code) => (
                    <label
                      key={code}
                      className="flex items-center gap-1.5 text-[12px]"
                    >
                      <input
                        type="checkbox"
                        checked={u.permissionCodes.includes(code)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...u.permissionCodes, code]
                            : u.permissionCodes.filter((c) => c !== code);
                          savePermissions(u.id, next);
                        }}
                      />
                      {PERMISSION_LABELS[code]}
                    </label>
                  ))}
                </div>
                {presets.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {presets.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        disabled={pending}
                        onClick={() => applyPreset(u.id, p.name)}
                        className="ui-btn ui-btn-ghost h-7 px-2 text-[11px]"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
