import { HistoryBoard } from "@/components/history/HistoryBoard";
import { prisma } from "@/lib/db";
import { requireBranchId, getSessionUser } from "@/lib/auth/session";
import { loadNewOperationFormData } from "@/lib/data/new-operation";
import type { TransactionType } from "@/lib/types/domain";

export const dynamic = "force-dynamic";

const TYPES: TransactionType[] = [
  "buy",
  "sell",
  "lend",
  "repay",
  "recolor",
  "expense",
  "adjustment",
  "exchange",
  "cash_in",
  "cash_out",
  "balance_transfer",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function dayStart(dateStr: string) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function mapLegsForEdit(
  type: TransactionType,
  legs: { walletId: string; amount: number }[],
) {
  const neg = legs.filter((l) => l.amount < 0);
  const pos = legs.filter((l) => l.amount > 0);
  const twoWallet = type === "buy" || type === "sell" || type === "recolor";

  if (twoWallet) {
    return {
      fromWalletId: neg[0]?.walletId ?? null,
      toWalletId: pos[0]?.walletId ?? null,
      debtWalletId: null as string | null,
      inputAmount: neg[0] != null ? Math.abs(neg[0].amount) : null,
      outputAmount: pos[0] != null ? Math.abs(pos[0].amount) : null,
    };
  }

  const leg = legs[0];
  return {
    fromWalletId: null as string | null,
    toWalletId: null as string | null,
    debtWalletId: leg?.walletId ?? null,
    inputAmount: leg != null ? Math.abs(leg.amount) : null,
    outputAmount: null as number | null,
  };
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    archived?: string;
    type?: string;
    date?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const showArchived = params.archived === "1";
  const typeFilter = params.type as TransactionType | undefined;
  const branchId = await requireBranchId();
  const user = await getSessionUser();

  let from: string;
  let to: string;

  if (params.from && params.to) {
    from = params.from <= params.to ? params.from : params.to;
    to = params.from <= params.to ? params.to : params.from;
  } else if (params.date) {
    from = params.date;
    to = params.date;
  } else {
    from = todayISO();
    to = todayISO();
  }

  const isRange = from !== to;
  const canCreate = user?.permissions.includes("create_operation") ?? false;

  const [operations, opForm] = await Promise.all([
    prisma.operation.findMany({
      where: {
        branchId,
        operationDate: { gte: dayStart(from), lte: dayStart(to) },
        ...(showArchived ? {} : { archived: false }),
        ...(typeFilter && TYPES.includes(typeFilter)
          ? { type: typeFilter }
          : {}),
      },
      include: {
        counterparty: true,
        createdBy: true,
        legs: { include: { wallet: true } },
      },
      orderBy: [{ operationDate: "desc" }, { createdAt: "desc" }],
      take: 2000,
    }),
    canCreate ? loadNewOperationFormData() : Promise.resolve(null),
  ]);

  const canArchive = user?.permissions.includes("archive_operation") ?? false;
  const canDelete = user?.permissions.includes("delete_operation") ?? false;

  return (
    <div className="px-4 py-5 sm:px-6">
      <HistoryBoard
        operations={operations.map((op) => {
          const type = op.type as TransactionType;
          const legs = op.legs.map((leg) => ({
            id: leg.id,
            walletId: leg.walletId,
            walletName: leg.wallet.name,
            amount: Number(leg.amount),
            rateUsd: leg.rateUsd != null ? Number(leg.rateUsd) : null,
          }));
          const mapped = mapLegsForEdit(
            type,
            legs.map((l) => ({ walletId: l.walletId, amount: l.amount })),
          );
          return {
            id: op.id,
            type,
            archived: op.archived,
            archiveComment: op.archiveComment,
            note: op.note,
            rate: op.rate != null ? Number(op.rate) : null,
            profit: op.profit != null ? Number(op.profit) : null,
            counterpartyId: op.counterpartyId,
            counterpartyLabel:
              op.counterparty?.name ?? op.counterpartyText ?? "Без контрагента",
            expenseCategoryId: op.expenseCategoryId,
            createdByName: op.createdBy.name,
            createdAt: op.createdAt.toISOString(),
            legs,
            ...mapped,
          };
        })}
        canArchive={canArchive}
        canDelete={canDelete}
        canCreate={canCreate}
        opForm={
          opForm
            ? {
                wallets: opForm.wallets,
                counterparties: opForm.counterparties,
                expenseCategories: opForm.expenseCategories,
                recommendedRates: opForm.recommendedRates,
                lastRates: opForm.lastRates,
              }
            : null
        }
        initialType={typeFilter}
        initialArchived={showArchived}
        dateFrom={from}
        dateTo={to}
        isRange={isRange}
      />
    </div>
  );
}
