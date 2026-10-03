import { requirePathAccess } from "@/lib/auth/require-access";

export default async function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePathAccess("/history");
  return children;
}
