"use client";

import { useActionState, useEffect } from "react";
import { loginAction, type AuthState } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthState | null, FormData>(
    loginAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      window.location.assign(state.redirectTo);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="login" className="ui-label">
          Логін
        </label>
        <input
          id="login"
          name="login"
          type="text"
          autoComplete="username"
          required
          className="ui-input"
        />
      </div>
      <div>
        <label htmlFor="password" className="ui-label">
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="ui-input"
        />
      </div>
      {state && !state.ok ? (
        <p className="text-[13px] text-danger">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending || Boolean(state?.ok)}
        className="ui-btn ui-btn-primary w-full"
      >
        {pending || state?.ok ? "Вхід…" : "Увійти"}
      </button>
    </form>
  );
}
