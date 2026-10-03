import { notFound } from "next/navigation";
import { CounterpartyDetailClient } from "@/components/counterparties/CounterpartyDetailClient";
import { prisma } from "@/lib/db";
import {
  getSessionUser,
  requireBranchId,
  userHasPermission,
} from "@/lib/auth/session";
import { loadNewOperationFormData } from "@/lib/data/new-operation";
import type { TransactionType } from "@/lib/types/domain";

export const dynamic = "force-dynamic";

export default async function CounterpartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const branchId = await requireBranchId();
  const user = await getSessionUser();
  const canManage = Boolean(
    user && userHasPermission(user, "manage_directories"),
  );
  const canCreate = Boolean(
    user && userHasPermission(user, "create_operation"),
  );

  const counterparty = await prisma.counterparty.findFirst({
    where: { id, isActive: true },
  });
  if (!counterparty) notFound();

  const [operations, debts, opForm] = await Promise.all([
    prisma.operation.findMany({
      where: {
        branchId,
        counterpartyId: id,
      },
      include: {
        createdBy: true,
        legs: { include: { wallet: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.debt.findMany({
      where: {
        counterpartyId: id,
        remaining: { gt: 0 },
        wallet: { branchId },
      },
      include: { wallet: true },
      orderBy: { createdAt: "desc" },
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

  return (
    <div className="px-4 py-5 sm:px-6">
      <CounterpartyDetailClient
        counterparty={{
          id: counterparty.id,
          name: counterparty.name,
          phone: counterparty.phone,
          telegram: counterparty.telegram,
          note: counterparty.note,
          temporary: counterparty.temporary,
        }}
        operations={operations.map((op) => ({
          id: op.id,
          type: op.type as TransactionType,
          note: op.note,
          rate: op.rate != null ? Number(op.rate) : null,
          createdAt: op.createdAt.toISOString(),
          createdByName: op.createdBy.name,
          archived: op.archived,
          legs: op.legs.map((l) => ({
            walletName: l.wallet.name,
            amount: Number(l.amount),
          })),
        }))}
        debts={debts.map((d) => ({
          id: d.id,
          direction: d.direction,
          remaining: Number(d.remaining),
          amount: Number(d.amount),
          walletId: d.walletId,
          walletName: d.wallet.name,
          note: d.note,
        }))}
        canManage={canManage}
        canCreate={canCreate}
        opForm={opForm}
      />
    </div>
  );
}
