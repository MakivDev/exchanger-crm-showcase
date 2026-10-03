import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { WalletsBalancesBar } from "@/components/layout/WalletsBalancesBar";
import { prisma } from "@/lib/db";
import {
  getCurrentBranchId,
  getSessionUser,
} from "@/lib/auth/session";
import { ensurePermissionsCatalog } from "@/lib/auth/ensure-permissions";
import {
  canAccessPath,
  firstAllowedPath,
} from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensurePermissionsCatalog();

  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const pathname = (await headers()).get("x-pathname");
  // Header may be missing; section layouts still enforce access.
  if (pathname && !canAccessPath(user, pathname)) {
    redirect(firstAllowedPath(user));
  }

  const [branches, currentBranchId, unreadCount] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getCurrentBranchId(),
    prisma.notification.count({
      where: { userId: user.id, read: false },
    }),
  ]);

  const wallets = currentBranchId
    ? await prisma.wallet.findMany({
        where: { branchId: currentBranchId, isActive: true },
        include: { currency: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="flex h-dvh flex-col lg:flex-row">
      <Sidebar
        branches={branches}
        currentBranchId={currentBranchId}
        userName={user.name}
        unreadCount={unreadCount}
        permissions={user.permissions}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <WalletsBalancesBar
          wallets={wallets.map((w) => ({
            id: w.id,
            name: w.name,
            color: w.color,
            balance: Number(w.balance),
            currencyCode: w.currency.code,
          }))}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
