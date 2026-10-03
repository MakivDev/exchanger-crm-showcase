import { WorkTopbar } from "@/components/layout/WorkTopbar";
import { requirePathAccess } from "@/lib/auth/require-access";

export default async function WorkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePathAccess("/work");

  return (
    <div className="flex flex-col">
      <WorkTopbar permissions={user.permissions} />
      <div className="px-4 py-5 sm:px-6">{children}</div>
    </div>
  );
}
