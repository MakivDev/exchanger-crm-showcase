import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { prisma } from "@/lib/db";
import { getSessionUser, requireBranchId } from "@/lib/auth/session";
import {
  createCounterpartyAction,
  updateCounterpartyAction,
  promoteCounterpartyAction,
} from "@/lib/actions/entities";

export const dynamic = "force-dynamic";

export default async function CounterpartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ archive?: string }>;
}) {
  const params = await searchParams;
  const showArchive = params.archive === "1";
  const user = await getSessionUser();
  const canManage = user?.permissions.includes("manage_directories") ?? false;
  const branchId = await requireBranchId();

  const openDebtCpIds = (
    await prisma.debt.findMany({
      where: {
        remaining: { gt: 0 },
        wallet: { branchId },
      },
      select: { counterpartyId: true },
      distinct: ["counterpartyId"],
    })
  ).map((d) => d.counterpartyId);

  const openSet = new Set(openDebtCpIds);

  const all = await prisma.counterparty.findMany({
    where: { isActive: true },
    orderBy: [{ temporary: "asc" }, { name: "asc" }],
  });

  const counterparties = all.filter((c) => {
    const hasOpen = openSet.has(c.id);
    if (showArchive) {
      return c.temporary && !hasOpen;
    }
    return !c.temporary || hasOpen;
  });

  return (
    <div className="px-4 py-5 sm:px-6">
      <PageHeader
        title="Контрагенти"
        description={
          showArchive
            ? "Архів тимчасових: без відкритих боргів на цій точці"
            : "Постійні та тимчасові з відкритим боргом"
        }
        actions={
          <Link
            href={showArchive ? "/counterparties" : "/counterparties?archive=1"}
            className="neo-btn neo-btn-ghost text-sm"
          >
            {showArchive ? "Основний список" : "Архів тимчасових"}
          </Link>
        }
      />

      {canManage && !showArchive ? (
        <Panel className="mb-4 p-4">
          <h2 className="mb-3 text-sm font-medium text-text">
            Додати в довідник
          </h2>
          <form
            action={createCounterpartyAction}
            className="flex flex-wrap gap-2"
          >
            <input
              name="name"
              required
              placeholder="Ім'я"
              className="neo-input"
            />
            <input name="phone" placeholder="Телефон" className="neo-input" />
            <input
              name="telegram"
              placeholder="Telegram"
              className="neo-input"
            />
            <input name="note" placeholder="Примітка" className="neo-input" />
            <button type="submit" className="neo-btn neo-btn-primary">
              Додати
            </button>
          </form>
          <p className="mt-2 text-xs text-text-muted">
            Нові з довідника — постійні. Тимчасові з&apos;являються з вільного
            тексту при боргу і ховаються в архів після повного погашення.
          </p>
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        <ul className="divide-y divide-border">
          {counterparties.length === 0 ? (
            <li className="px-4 py-6 text-sm text-text-muted">
              Немає записів
            </li>
          ) : (
            counterparties.map((c) => (
              <li key={c.id} className="px-4 py-3 sm:px-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/counterparties/${c.id}`}
                    className="font-medium text-text hover:text-accent"
                  >
                    {c.name}
                  </Link>
                  {c.temporary ? (
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">
                      тимчасовий
                    </span>
                  ) : (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                      постійний
                    </span>
                  )}
                  {openSet.has(c.id) ? (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted">
                      є борг
                    </span>
                  ) : null}
                </div>
                {canManage ? (
                  <form
                    action={updateCounterpartyAction}
                    className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <input
                      name="name"
                      defaultValue={c.name}
                      required
                      className="neo-input text-sm font-medium"
                    />
                    <input
                      name="phone"
                      defaultValue={c.phone ?? ""}
                      placeholder="Телефон"
                      className="neo-input text-sm"
                    />
                    <input
                      name="telegram"
                      defaultValue={c.telegram ?? ""}
                      placeholder="Telegram"
                      className="neo-input text-sm"
                    />
                    <input
                      name="note"
                      defaultValue={c.note ?? ""}
                      placeholder="Примітка"
                      className="neo-input min-w-[12rem] flex-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="neo-btn neo-btn-ghost text-xs"
                    >
                      Зберегти
                    </button>
                    {c.temporary ? (
                      <button
                        type="submit"
                        formAction={promoteCounterpartyAction}
                        className="neo-btn neo-btn-primary text-xs"
                      >
                        Зробити постійним
                      </button>
                    ) : null}
                  </form>
                ) : (
                  <p className="text-sm text-text-muted">
                    {[c.phone, c.telegram, c.note].filter(Boolean).join(" · ") ||
                      "Без контактів"}
                  </p>
                )}
              </li>
            ))
          )}
        </ul>
      </Panel>
    </div>
  );
}
