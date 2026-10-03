import { Panel } from "@/components/ui/Panel";
import { prisma } from "@/lib/db";
import { requireBranchId } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import {
  approxUsd,
  formatApproxUsd,
  loadWalletLastRatesMap,
} from "@/lib/money/wallet-last-rate";

export const dynamic = "force-dynamic";

export default async function BalancesPage() {
  const branchId = await requireBranchId();
  const [wallets, lastRates] = await Promise.all([
    prisma.wallet.findMany({
      where: { branchId, isActive: true },
      include: { currency: true },
      orderBy: { name: "asc" },
    }),
    loadWalletLastRatesMap(branchId),
  ]);

  let totalUsd = 0;
  let totalOk = true;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-text">Залишки зараз</h2>
        <p className="text-sm text-text-muted">
          Приблизний USD за останнім курсом кожної каси
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {wallets.map((w) => {
          const rate = lastRates[w.id] ?? null;
          const bal = Number(w.balance);
          const usd = approxUsd(bal, rate);
          if (usd != null) totalUsd += usd;
          else if (bal !== 0) totalOk = false;
          return (
            <Panel key={w.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-text-muted">{w.currency.code}</p>
                  <h3 className="mt-1 font-medium text-text">{w.name}</h3>
                </div>
                <span
                  className="mt-1 h-3 w-3 rounded-full"
                  style={{ backgroundColor: w.color }}
                  aria-hidden
                />
              </div>
              <p className="mt-4 font-mono-num text-2xl font-semibold tracking-tight text-text">
                {formatMoney(bal)}
              </p>
              <p className="mt-1 font-mono-num text-[13px] text-text-muted">
                {formatApproxUsd(bal, rate) ?? "немає останнього курсу"}
              </p>
            </Panel>
          );
        })}
      </div>
      <Panel className="p-4">
        <div className="text-[10px] uppercase tracking-wide text-text-muted">
          Σ приблизно в USD
        </div>
        <div className="mt-1 font-mono-num text-[20px] font-semibold">
          {totalOk ? `≈ $${formatMoney(totalUsd, 4)}` : "— (не всі курси)"}
        </div>
        <p className="mt-1 text-[12px] text-text-muted">
          Кожна каса за своїм останнім курсом до USD
        </p>
      </Panel>
    </div>
  );
}
