import { PageHeader, Panel } from "@/components/ui/Panel";
import { prisma } from "@/lib/db";
import {
  getSessionUser,
  requireBranchId,
} from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import {
  adjustWalletBalanceAction,
  createWalletAction,
} from "@/lib/actions/entities";
import { WalletColorPicker } from "@/components/wallets/WalletColorPicker";
import { DeleteWalletButton } from "@/components/wallets/DeleteWalletButton";
import {
  formatApproxUsd,
  loadWalletLastRatesMap,
} from "@/lib/money/wallet-last-rate";

export const dynamic = "force-dynamic";

export default async function WalletsPage() {
  const branchId = await requireBranchId();
  const user = await getSessionUser();
  const canManage = user?.permissions.includes("manage_directories") ?? false;
  const canAdjust = user?.permissions.includes("edit_opening_balance") ?? false;

  const [wallets, currencies, lastRates] = await Promise.all([
    prisma.wallet.findMany({
      where: { branchId, isActive: true },
      include: { currency: true, branch: true },
      orderBy: { name: "asc" },
    }),
    prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    }),
    loadWalletLastRatesMap(branchId),
  ]);

  return (
    <div className="px-4 py-5 sm:px-6">
      <PageHeader
        title="Каси"
        description="Окрема каса на валюту / мережу · дані з PostgreSQL"
      />

      {canManage ? (
        <Panel className="mb-4 p-4">
          <h2 className="mb-3 text-sm font-medium text-text">Створити касу</h2>
          <form
            action={createWalletAction}
            className="flex flex-wrap items-end gap-2"
          >
            <label className="text-sm">
              <span className="mb-1 block text-text-muted">Назва</span>
              <input
                name="name"
                required
                placeholder="mono UAH"
                className="rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-text"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-muted">Валюта</span>
              <select
                name="currencyId"
                required
                className="rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-text"
              >
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-muted">Колір</span>
              <input
                name="color"
                type="color"
                defaultValue="#2F6B4F"
                className="h-10 w-14 rounded-[var(--radius-control)] border border-border bg-bg"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-text-muted">Старт. залишок</span>
              <input
                name="balance"
                defaultValue="0"
                className="w-28 rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 font-mono-num text-text"
              />
            </label>
            <button
              type="submit"
              className="rounded-[var(--radius-control)] bg-accent px-3 py-2 text-sm font-medium text-accent-fg"
            >
              Створити касу
            </button>
          </form>
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {wallets.map((w) => (
          <Panel key={w.id} className="p-4">
            <div className="flex items-center gap-3">
              {canManage ? (
                <WalletColorPicker walletId={w.id} color={w.color} />
              ) : (
                <span
                  className="h-10 w-10 rounded-[var(--radius-control)]"
                  style={{ backgroundColor: w.color }}
                  aria-hidden
                />
              )}
              <div>
                <h2 className="font-medium text-text">{w.name}</h2>
                <p className="text-sm text-text-muted">
                  {w.currency.code} · {w.branch.name}
                </p>
              </div>
            </div>
            <p className="mt-4 font-mono-num text-xl font-semibold text-text">
              {formatMoney(Number(w.balance))}
            </p>
            <p className="mt-1 font-mono-num text-[12px] text-text-muted">
              {formatApproxUsd(Number(w.balance), lastRates[w.id] ?? null) ??
                "немає останнього курсу"}
            </p>
            {canAdjust ? (
              <form
                action={adjustWalletBalanceAction}
                className="mt-3 space-y-2 border-t border-border pt-3"
              >
                <input type="hidden" name="walletId" value={w.id} />
                <input
                  name="newBalance"
                  required
                  placeholder="Новий залишок"
                  defaultValue={String(Number(w.balance))}
                  className="w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 font-mono-num text-sm text-text"
                />
                <input
                  name="comment"
                  required
                  placeholder="Коментар (обов'язково)"
                  className="w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-sm text-text"
                />
                <button
                  type="submit"
                  className="rounded-[var(--radius-control)] border border-border bg-surface-2 px-3 py-1.5 text-xs text-text hover:bg-accent-soft"
                >
                  Скоригувати залишок
                </button>
              </form>
            ) : (
              <p className="mt-1 text-xs text-text-muted">
                Корекція - лише з дозволом + аудит
              </p>
            )}
            {canManage ? (
              <DeleteWalletButton walletId={w.id} walletName={w.name} />
            ) : null}
          </Panel>
        ))}
      </div>
    </div>
  );
}
