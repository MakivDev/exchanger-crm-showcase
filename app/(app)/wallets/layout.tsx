import { requirePathAccess } from "@/lib/auth/require-access";

export default async function WalletsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePathAccess("/wallets");
  return children;
}
