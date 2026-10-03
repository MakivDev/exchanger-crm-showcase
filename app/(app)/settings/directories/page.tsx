import { Panel } from "@/components/ui/Panel";
import { BranchesAdmin } from "@/components/settings/BranchesAdmin";
import { prisma } from "@/lib/db";
import {
  requireUser,
  userHasPermission,
} from "@/lib/auth/session";
import {
  createCurrencyAction,
  createExpenseCategoryAction,
} from "@/lib/actions/entities";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DirectoriesPage() {
  const user = await requireUser();
  const canManage = userHasPermission(user, "manage_directories");

  const [categories, currencies, walletCount, counterpartyCount, branches] =
    await Promise.all([
      prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
      prisma.currency.findMany({ orderBy: { code: "asc" } }),
      prisma.wallet.count({ where: { isActive: true } }),
      prisma.counterparty.count({ where: { isActive: true } }),
      prisma.branch.findMany({
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      }),
    ]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <BranchesAdmin branches={branches} canManage={canManage} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Panel className="p-4">
          <h2 className="font-medium text-text">Каси</h2>
          <p className="mt-1 text-[13px] text-text-muted">
            Активних: {walletCount}
          </p>
          <Link
            href="/wallets"
            className="mt-3 inline-block text-[13px] text-accent hover:underline"
          >
            Відкрити каси
          </Link>
        </Panel>
        <Panel className="p-4">
          <h2 className="font-medium text-text">Контрагенти</h2>
          <p className="mt-1 text-[13px] text-text-muted">
            Активних: {counterpartyCount}
          </p>
          <Link
            href="/counterparties"
            className="mt-3 inline-block text-[13px] text-accent hover:underline"
          >
            Відкрити контрагенти
          </Link>
        </Panel>
      </div>

      <Panel className="p-4 sm:p-5">
        <h2 className="font-medium text-text">Валюти</h2>
        <ul className="mt-3 space-y-1 text-[13px] text-text">
          {currencies.map((c) => (
            <li key={c.id}>
              <span className="font-mono-num">{c.code}</span> — {c.name}
            </li>
          ))}
        </ul>
        {canManage ? (
          <form
            action={createCurrencyAction}
            className="mt-4 flex flex-wrap gap-2"
          >
            <input name="code" required placeholder="Код" className="ui-input w-24" />
            <input name="name" required placeholder="Назва" className="ui-input" />
            <button type="submit" className="ui-btn ui-btn-primary">
              Додати валюту
            </button>
          </form>
        ) : null}
      </Panel>

      <Panel className="p-4 sm:p-5">
        <h2 className="font-medium text-text">Категорії витрат</h2>
        <ul className="mt-3 space-y-1 text-[13px] text-text">
          {categories.map((c) => (
            <li key={c.id}>
              {c.name}
              {!c.isActive ? (
                <span className="ml-2 text-text-muted">(неактивна)</span>
              ) : null}
            </li>
          ))}
        </ul>
        {canManage ? (
          <form
            action={createExpenseCategoryAction}
            className="mt-4 flex flex-wrap gap-2"
          >
            <input
              name="name"
              required
              placeholder="Назва категорії"
              className="ui-input"
            />
            <button type="submit" className="ui-btn ui-btn-primary">
              Додати категорію
            </button>
          </form>
        ) : null}
      </Panel>

      <Panel className="p-4 text-[13px] text-text-muted">
        Типи: купівля, продаж, борг, повернення, перефарбування, витрата. Усі
        суми з курсом до USD (одиниць валюти за 1 USD).
      </Panel>
    </div>
  );
}
