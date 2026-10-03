import { SettingsTopbar } from "@/components/layout/SettingsTopbar";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col">
      <SettingsTopbar permissions={user.permissions} />
      <div className="px-4 py-5 sm:px-6">{children}</div>
    </div>
  );
}
