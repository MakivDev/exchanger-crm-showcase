import { Panel } from "@/components/ui/Panel";
import { prisma } from "@/lib/db";
import {
  requireUser,
  userHasPermission,
} from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await requireUser();
  if (!userHasPermission(user, "view_audit")) {
    return (
      <Panel className="p-4 text-sm text-text-muted">
        Немає дозволу переглядати аудит
      </Panel>
    );
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Panel className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-medium text-text">Аудит</h2>
          <p className="text-sm text-text-muted">Хто / коли / що змінив</p>
        </div>
        <ul className="divide-y divide-border">
          {logs.length === 0 ? (
            <li className="px-4 py-6 text-sm text-text-muted">Поки порожньо</li>
          ) : (
            logs.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <p className="text-sm text-text">
                  <span className="font-medium">{a.actorName}</span> · {a.action}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {formatDateTime(a.createdAt.toISOString())}
                  {a.entity ? ` · ${a.entity}` : ""}
                  {a.comment ? ` · ${a.comment}` : ""}
                </p>
              </li>
            ))
          )}
        </ul>
      </Panel>
    </div>
  );
}
