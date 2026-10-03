import { prisma } from "@/lib/db";
import { requireUser, userHasPermission } from "@/lib/auth/session";
import { UsersAdmin } from "@/components/settings/UsersAdmin";
import { Panel } from "@/components/ui/Panel";

export const dynamic = "force-dynamic";

export default async function SettingsUsersPage() {
  const user = await requireUser();
  if (!userHasPermission(user, "manage_users")) {
    return (
      <Panel className="p-4 text-sm text-text-muted">
        Немає дозволу керувати користувачами
      </Panel>
    );
  }

  const [users, presets] = await Promise.all([
    prisma.user.findMany({
      include: {
        permissions: { include: { permission: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.permissionPreset.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <UsersAdmin
      currentUserId={user.id}
      users={users.map((u) => ({
        id: u.id,
        login: u.login,
        name: u.name,
        isActive: u.isActive,
        permissionCodes: u.permissions.map((p) => p.permission.code),
      }))}
      presets={presets.map((p) => ({ name: p.name, codes: p.codes }))}
    />
  );
}
