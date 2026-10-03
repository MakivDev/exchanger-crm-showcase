import { requirePathAccess } from "@/lib/auth/require-access";

export default async function SettingsAuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePathAccess("/settings/audit");
  return children;
}
