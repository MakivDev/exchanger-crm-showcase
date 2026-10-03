import { requirePathAccess } from "@/lib/auth/require-access";

export default async function SettingsDirectoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePathAccess("/settings/directories");
  return children;
}
