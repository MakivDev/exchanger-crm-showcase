import { DaySummaryBoard } from "@/components/day-summary/DaySummaryBoard";
import { loadDaySummary } from "@/lib/data/day-summary";
import { getSessionUser, userHasPermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DaySummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const dateStr = params.date ?? new Date().toISOString().slice(0, 10);
  const user = await getSessionUser();
  const canEdit = Boolean(
    user && userHasPermission(user, "create_operation"),
  );

  const data = await loadDaySummary(dateStr);

  return <DaySummaryBoard data={data} canEdit={canEdit} />;
}
