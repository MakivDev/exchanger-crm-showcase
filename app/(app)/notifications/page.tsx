import { NotificationsBoard } from "@/components/notifications/NotificationsBoard";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return (
    <div className="px-4 py-5 sm:px-6">
      <NotificationsBoard
        notifications={notifications.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
