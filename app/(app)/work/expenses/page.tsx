import { ExpensesBoard } from "@/components/expenses/ExpensesBoard";
import { loadNewOperationFormData } from "@/lib/data/new-operation";
import { prisma } from "@/lib/db";
import {
  getSessionUser,
  requireBranchId,
  userHasPermission,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const branchId = await requireBranchId();
  const user = await getSessionUser();
  const canCreate = Boolean(
    user && userHasPermission(user, "create_operation"),
  );

  const [operations, opForm] = await Promise.all([
    prisma.operation.findMany({
      where: {
        branchId,
        type: "expense",
        archived: false,
      },
      include: {
        expenseCategory: true,
        createdBy: true,
        legs: { include: { wallet: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    canCreate
      ? loadNewOperationFormData()
      : Promise.resolve({
          wallets: [],
          counterparties: [],
          expenseCategories: [],
          recommendedRates: {},
        }),
  ]);

  return (
    <ExpensesBoard
      canCreate={canCreate}
      opForm={opForm}
      operations={operations.map((op) => {
        const leg = op.legs[0];
        return {
          id: op.id,
          amount: leg ? Math.abs(Number(leg.amount)) : 0,
          rate: op.rate != null ? Number(op.rate) : null,
          usdAmount: op.usdAmount != null ? Number(op.usdAmount) : null,
          note: op.note,
          categoryName: op.expenseCategory?.name ?? null,
          walletName: leg?.wallet.name ?? "—",
          createdByName: op.createdBy.name,
          createdAt: op.createdAt.toISOString(),
        };
      })}
    />
  );
}
