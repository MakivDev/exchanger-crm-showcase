import { redirect } from "next/navigation";

export default async function NewOperationPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; counterpartyId?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  qs.set("newOp", "1");
  if (params.date) qs.set("date", params.date);
  if (params.counterpartyId) qs.set("counterpartyId", params.counterpartyId);
  redirect(`/work/journal?${qs.toString()}`);
}
