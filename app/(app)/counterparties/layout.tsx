import { requirePathAccess } from "@/lib/auth/require-access";

export default async function CounterpartiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePathAccess("/counterparties");
  return children;
}
