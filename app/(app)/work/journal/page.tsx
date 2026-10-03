import { JournalPositionsBoard } from "@/components/journal/JournalPositionsBoard";
import { loadJournalDay } from "@/lib/data/journal-positions";
import { getSessionUser, userHasPermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const canEdit = Boolean(
    user && userHasPermission(user, "create_operation"),
  );

  let from: string;
  let to: string | undefined;

  if (params.from && params.to) {
    from = params.from <= params.to ? params.from : params.to;
    to = params.from <= params.to ? params.to : params.from;
  } else if (params.date) {
    from = params.date;
  } else {
    from = todayISO();
  }

  const data = await loadJournalDay(from, to);

  return <JournalPositionsBoard data={data} canEdit={canEdit} />;
}
