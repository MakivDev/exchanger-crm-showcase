"use client";

import { useEffect, useState, useTransition } from "react";
import { CaretLeft, CaretRight, Plus, Trash } from "@phosphor-icons/react";
import {
  completeSetup,
  getSetupSummary,
  saveSetupAccount,
  saveSetupBranches,
  saveSetupDirectories,
  saveSetupWallets,
} from "@/lib/actions/setup";
import {
  SETUP_DEFAULT_CURRENCIES,
  SETUP_DEFAULT_EXPENSE_CATEGORIES,
  SETUP_STEPS,
  defaultWalletColor,
  type SetupStepId,
} from "@/lib/setup";
import { formatMoney } from "@/lib/format";

type Props = {
  initialStep: SetupStepId;
  completedSteps: SetupStepId[];
};

type WalletRow = {
  key: string;
  name: string;
  currencyCode: string;
  branchName: string;
  balance: string;
  color: string;
};

type CpRow = {
  key: string;
  name: string;
  phone: string;
  telegram: string;
};

function newKey() {
  return Math.random().toString(36).slice(2, 10);
}

export function SetupWizard({ initialStep, completedSteps }: Props) {
  const [step, setStep] = useState<SetupStepId>(initialStep);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const [login, setLogin] = useState("admin");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [branchNames, setBranchNames] = useState(["Точка 1"]);

  const [wallets, setWallets] = useState<WalletRow[]>([
    {
      key: newKey(),
      name: "Каса UAH",
      currencyCode: "UAH",
      branchName: "Точка 1",
      balance: "0",
      color: defaultWalletColor("UAH"),
    },
    {
      key: newKey(),
      name: "Каса USD",
      currencyCode: "USD",
      branchName: "Точка 1",
      balance: "0",
      color: defaultWalletColor("USD"),
    },
  ]);

  const [categories, setCategories] = useState<string[]>([
    ...SETUP_DEFAULT_EXPENSE_CATEGORIES,
  ]);
  const [counterparties, setCounterparties] = useState<CpRow[]>([]);

  const [summary, setSummary] = useState<
    Awaited<ReturnType<typeof getSetupSummary>>["data"] | null
  >(null);

  useEffect(() => {
    if (initialStep > 1 || completedSteps.length > 0) {
      getSetupSummary().then((r) => {
        if (!r.ok) return;
        if (r.data.admin) {
          setLogin(r.data.admin.login);
          setName(r.data.admin.name);
        }
        if (r.data.branches.length) {
          setBranchNames(r.data.branches);
        }
        if (r.data.wallets.length) {
          setWallets(
            r.data.wallets.map((w) => ({
              key: newKey(),
              name: w.name,
              currencyCode: w.currencyCode,
              branchName: w.branchName,
              balance: String(w.balance),
              color: w.color,
            })),
          );
        }
        if (r.data.expenseCategories.length) {
          setCategories(r.data.expenseCategories);
        }
        if (r.data.counterparties.length) {
          setCounterparties(
            r.data.counterparties.map((c) => ({
              key: newKey(),
              name: c.name,
              phone: c.phone ?? "",
              telegram: c.telegram ?? "",
            })),
          );
        }
      });
    }
  }, [initialStep, completedSteps.length]);

  useEffect(() => {
    if (step === 5) {
      getSetupSummary().then((r) => {
        if (r.ok) setSummary(r.data);
      });
    }
  }, [step]);

  function syncWalletBranches(names: string[]) {
    const first = names[0] ?? "Точка 1";
    setWallets((prev) =>
      prev.map((w) =>
        names.includes(w.branchName) ? w : { ...w, branchName: first },
      ),
    );
  }

  function handleNext() {
    setError("");
    start(async () => {
      if (step === 1) {
        if (!password && !completedSteps.includes(1)) {
          setError("Вкажіть пароль для входу");
          return;
        }
        if (password && password !== confirm) {
          setError("Паролі не збігаються");
          return;
        }
        if (password && password.length < 6) {
          setError("Пароль має бути мінімум 6 символів");
          return;
        }
        const res = await saveSetupAccount({ login, name, password });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setStep(2);
        return;
      }

      if (step === 2) {
        const res = await saveSetupBranches({ names: branchNames });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        syncWalletBranches(branchNames.map((n) => n.trim()).filter(Boolean));
        setStep(3);
        return;
      }

      if (step === 3) {
        const res = await saveSetupWallets({
          wallets: wallets.map((w) => ({
            name: w.name,
            currencyCode: w.currencyCode,
            branchName: w.branchName,
            balance: w.balance,
            color: w.color,
          })),
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setStep(4);
        return;
      }

      if (step === 4) {
        const res = await saveSetupDirectories({
          expenseCategories: categories,
          counterparties: counterparties.map((c) => ({
            name: c.name,
            phone: c.phone || undefined,
            telegram: c.telegram || undefined,
          })),
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setStep(5);
        return;
      }

      if (step === 5) {
        const res = await completeSetup();
        if (!res.ok) {
          setError(res.error);
          return;
        }
        window.location.assign(res.redirectTo);
      }
    });
  }

  return (
    <div className="w-full max-w-xl">
      <div className="mb-6">
        <p className="text-[12px] font-medium uppercase tracking-wide text-accent">
          Перше налаштування
        </p>
        <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-text">
          {SETUP_STEPS[step - 1]?.title}
        </h1>
        <p className="mt-1 text-[13px] text-text-muted">
          Крок {step} з {SETUP_STEPS.length}. Дані можна змінити пізніше в
          налаштуваннях.
        </p>
      </div>

      <ol className="mb-5 flex flex-wrap gap-1.5">
        {SETUP_STEPS.map((s) => {
          const active = s.id === step;
          const done = s.id < step || completedSteps.includes(s.id);
          return (
            <li
              key={s.id}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                active
                  ? "bg-accent text-accent-fg"
                  : done
                    ? "bg-accent-soft text-accent"
                    : "bg-surface-2 text-text-muted"
              }`}
            >
              {s.short}
            </li>
          );
        })}
      </ol>

      <div className="ui-panel space-y-4 p-5">
        {step === 1 ? (
          <div className="space-y-3">
            <div>
              <label className="ui-label">Ім&apos;я адміністратора</label>
              <input
                className="ui-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Наприклад: Олександр"
                autoFocus
              />
            </div>
            <div>
              <label className="ui-label">Логін</label>
              <input
                className="ui-input"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="ui-label">Пароль</label>
                <input
                  type="password"
                  className="ui-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="ui-label">Ще раз пароль</label>
                <input
                  type="password"
                  className="ui-input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-[13px] text-text-muted">
              Точки продажу / офіси. Пізніше можна додати ще.
            </p>
            {branchNames.map((bn, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="ui-input flex-1"
                  value={bn}
                  onChange={(e) => {
                    const next = [...branchNames];
                    next[i] = e.target.value;
                    setBranchNames(next);
                  }}
                  placeholder={`Точка ${i + 1}`}
                />
                {branchNames.length > 1 ? (
                  <button
                    type="button"
                    className="ui-btn ui-btn-ghost h-10 w-10 p-0"
                    onClick={() =>
                      setBranchNames((prev) => prev.filter((_, j) => j !== i))
                    }
                    aria-label="Видалити"
                  >
                    <Trash size={16} />
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              className="ui-btn ui-btn-ghost gap-1"
              onClick={() =>
                setBranchNames((prev) => [
                  ...prev,
                  `Точка ${prev.length + 1}`,
                ])
              }
            >
              <Plus size={14} />
              Додати точку
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-[13px] text-text-muted">
              Каси з початковими залишками. Валюта — код (UAH, USD…).
            </p>
            {wallets.map((w) => (
              <div
                key={w.key}
                className="rounded-[var(--radius)] border border-border bg-surface-2 p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={w.color}
                    onChange={(e) =>
                      setWallets((prev) =>
                        prev.map((x) =>
                          x.key === w.key
                            ? { ...x, color: e.target.value }
                            : x,
                        ),
                      )
                    }
                    className="h-9 w-9 cursor-pointer rounded border border-border bg-transparent p-0"
                    title="Колір"
                  />
                  <input
                    className="ui-input flex-1"
                    value={w.name}
                    onChange={(e) =>
                      setWallets((prev) =>
                        prev.map((x) =>
                          x.key === w.key ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Назва каси"
                  />
                  {wallets.length > 1 ? (
                    <button
                      type="button"
                      className="ui-btn ui-btn-ghost h-9 w-9 p-0"
                      onClick={() =>
                        setWallets((prev) =>
                          prev.filter((x) => x.key !== w.key),
                        )
                      }
                    >
                      <Trash size={14} />
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <label className="ui-label">Валюта</label>
                    <select
                      className="ui-input"
                      value={w.currencyCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        setWallets((prev) =>
                          prev.map((x) =>
                            x.key === w.key
                              ? {
                                  ...x,
                                  currencyCode: code,
                                  color: defaultWalletColor(code),
                                }
                              : x,
                          ),
                        );
                      }}
                    >
                      {SETUP_DEFAULT_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="ui-label">Точка</label>
                    <select
                      className="ui-input"
                      value={w.branchName}
                      onChange={(e) =>
                        setWallets((prev) =>
                          prev.map((x) =>
                            x.key === w.key
                              ? { ...x, branchName: e.target.value }
                              : x,
                          ),
                        )
                      }
                    >
                      {branchNames
                        .map((n) => n.trim())
                        .filter(Boolean)
                        .map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="ui-label">Баланс</label>
                    <input
                      className="ui-input font-mono-num"
                      inputMode="decimal"
                      value={w.balance}
                      onChange={(e) =>
                        setWallets((prev) =>
                          prev.map((x) =>
                            x.key === w.key
                              ? { ...x, balance: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="ui-btn ui-btn-ghost gap-1"
              onClick={() => {
                const branch =
                  branchNames.map((n) => n.trim()).filter(Boolean)[0] ??
                  "Точка 1";
                setWallets((prev) => [
                  ...prev,
                  {
                    key: newKey(),
                    name: "",
                    currencyCode: "UAH",
                    branchName: branch,
                    balance: "0",
                    color: defaultWalletColor("UAH"),
                  },
                ]);
              }}
            >
              <Plus size={14} />
              Додати касу
            </button>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-[12px] font-medium uppercase tracking-wide text-text-muted">
                Категорії витрат
              </p>
              {categories.map((cat, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="ui-input flex-1"
                    value={cat}
                    onChange={(e) => {
                      const next = [...categories];
                      next[i] = e.target.value;
                      setCategories(next);
                    }}
                  />
                  {categories.length > 1 ? (
                    <button
                      type="button"
                      className="ui-btn ui-btn-ghost h-10 w-10 p-0"
                      onClick={() =>
                        setCategories((prev) =>
                          prev.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <Trash size={14} />
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                className="ui-btn ui-btn-ghost gap-1"
                onClick={() => setCategories((prev) => [...prev, ""])}
              >
                <Plus size={14} />
                Категорія
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[12px] font-medium uppercase tracking-wide text-text-muted">
                Контрагенти (необов&apos;язково)
              </p>
              {counterparties.length === 0 ? (
                <p className="text-[12px] text-text-muted">
                  Можна додати пізніше з розділу «Контрагенти».
                </p>
              ) : null}
              {counterparties.map((cp) => (
                <div
                  key={cp.key}
                  className="rounded-[var(--radius)] border border-border bg-surface-2 p-2.5"
                >
                  <div className="mb-1.5 flex gap-2">
                    <input
                      className="ui-input flex-1"
                      placeholder="Ім'я"
                      value={cp.name}
                      onChange={(e) =>
                        setCounterparties((prev) =>
                          prev.map((x) =>
                            x.key === cp.key
                              ? { ...x, name: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="ui-btn ui-btn-ghost h-10 w-10 p-0"
                      onClick={() =>
                        setCounterparties((prev) =>
                          prev.filter((x) => x.key !== cp.key),
                        )
                      }
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="ui-input"
                      placeholder="Телефон"
                      value={cp.phone}
                      onChange={(e) =>
                        setCounterparties((prev) =>
                          prev.map((x) =>
                            x.key === cp.key
                              ? { ...x, phone: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                    <input
                      className="ui-input"
                      placeholder="Telegram"
                      value={cp.telegram}
                      onChange={(e) =>
                        setCounterparties((prev) =>
                          prev.map((x) =>
                            x.key === cp.key
                              ? { ...x, telegram: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="ui-btn ui-btn-ghost gap-1"
                onClick={() =>
                  setCounterparties((prev) => [
                    ...prev,
                    { key: newKey(), name: "", phone: "", telegram: "" },
                  ])
                }
              >
                <Plus size={14} />
                Контрагент
              </button>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4 text-[13px]">
            {!summary ? (
              <p className="text-text-muted">Завантаження зводки…</p>
            ) : (
              <>
                <SummaryBlock title="Адміністратор">
                  <p>
                    {summary.admin?.name}{" "}
                    <span className="text-text-muted">
                      ({summary.admin?.login})
                    </span>
                  </p>
                </SummaryBlock>
                <SummaryBlock title="Точки">
                  <ul className="list-inside list-disc">
                    {summary.branches.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </SummaryBlock>
                <SummaryBlock title="Каси">
                  <ul className="space-y-1">
                    {summary.wallets.map((w) => (
                      <li
                        key={`${w.branchName}-${w.name}`}
                        className="flex flex-wrap items-baseline gap-x-2"
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ background: w.color }}
                        />
                        <span className="font-medium">{w.name}</span>
                        <span className="text-text-muted">
                          {w.branchName} · {w.currencyCode}
                        </span>
                        <span className="font-mono-num">
                          {formatMoney(w.balance)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </SummaryBlock>
                <SummaryBlock title="Категорії витрат">
                  <p className="text-text-muted">
                    {summary.expenseCategories.join(", ") || "—"}
                  </p>
                </SummaryBlock>
                <SummaryBlock title="Контрагенти">
                  <p className="text-text-muted">
                    {summary.counterparties.length
                      ? summary.counterparties.map((c) => c.name).join(", ")
                      : "Поки немає"}
                  </p>
                </SummaryBlock>
              </>
            )}
          </div>
        ) : null}

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <button
            type="button"
            className="ui-btn ui-btn-ghost gap-1"
            disabled={pending || step === 1}
            onClick={() => {
              setError("");
              setStep((s) => (s > 1 ? ((s - 1) as SetupStepId) : s));
            }}
          >
            <CaretLeft size={14} />
            Назад
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-primary gap-1"
            disabled={pending}
            onClick={handleNext}
          >
            {pending
              ? "…"
              : step === 5
                ? "Запустити CRM"
                : "Далі"}
            {step < 5 ? <CaretRight size={14} /> : null}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
        {title}
      </p>
      <div className="text-text">{children}</div>
    </div>
  );
}
