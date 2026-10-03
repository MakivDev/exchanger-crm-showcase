import { requirePathAccess } from "@/lib/auth/require-access";

export default async function SettingsUsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePathAccess("/settings/users");
  return children;
}
