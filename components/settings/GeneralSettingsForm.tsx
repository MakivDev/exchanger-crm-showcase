"use client";

import { useActionState } from "react";
import { Panel } from "@/components/ui/Panel";
import { updateProfileAction } from "@/lib/actions/auth";

export function GeneralSettingsForm({
  login,
  name,
}: {
  login: string;
  name: string;
}) {
  const [state, formAction, pending] = useActionState<
    { ok: boolean; error?: string } | null,
    FormData
  >(updateProfileAction, null);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Panel className="p-4 sm:p-5">
        <h2 className="font-medium text-text">Профіль</h2>
        <p className="mt-1 text-[13px] text-text-muted">
          Логін: <span className="font-mono-num">{login}</span>
        </p>
        <form action={formAction} className="mt-4 space-y-3">
          <div>
            <label htmlFor="profile-name" className="ui-label">
              Ім&apos;я
            </label>
            <input
              id="profile-name"
              name="name"
              defaultValue={name}
              required
              className="ui-input"
            />
          </div>
          {state?.ok ? (
            <p className="text-[13px] text-success">Збережено</p>
          ) : null}
          {state && !state.ok ? (
            <p className="text-[13px] text-danger">{state.error}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="ui-btn ui-btn-primary"
          >
            {pending ? "Збереження…" : "Зберегти"}
          </button>
        </form>
      </Panel>
    </div>
  );
}
