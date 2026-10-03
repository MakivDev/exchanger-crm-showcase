import { DebtsBoard } from "@/components/debts/DebtsBoard";
import { prisma } from "@/lib/db";
import {
  getSessionUser,
  requireBranchId,
  userHasPermission,
} from "@/lib/auth/session";
import { loadNewOperationFormData } from "@/lib/data/new-operation";

export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const branchId = await requireBranchId();
  const user = await getSessionUser();
  const canCreate = Boolean(
    user && userHasPermission(user, "create_operation"),
  );

  const [debts, wallets, opForm] = await Promise.all([
    prisma.debt.findMany({
      where: {
        remaining: { gt: 0 },
        wallet: { branchId },
      },
      include: {
        counterparty: true,
        wallet: { include: { currency: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.wallet.findMany({
      where: { branchId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    canCreate
      ? loadNewOperationFormData()
      : Promise.resolve({
          wallets: [],
          counterparties: [],
          expenseCategories: [],
          recommendedRates: {},
          lastRates: {},
        }),
  ]);

  const lastRates = opForm.lastRates ?? {};

  return (
    <DebtsBoard
      debts={debts.map((d) => ({
        id: d.id,
        direction: d.direction as "they_owe_us" | "we_owe_them",
        amount: Number(d.amount),
        remaining: Number(d.remaining),
        note: d.note,
        counterpartyId: d.counterpartyId,
        counterpartyName: d.counterparty.name,
        walletId: d.walletId,
        walletName: d.wallet.name,
        currencyCode: d.wallet.currency.code,
        createdAt: d.createdAt.toISOString(),
      }))}
      wallets={wallets}
      canCreate={canCreate}
      opForm={opForm}
      lastRates={lastRates}
    />
  );
}
