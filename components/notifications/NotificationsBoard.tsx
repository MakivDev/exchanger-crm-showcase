"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { DataPagination } from "@/components/ui/DataPagination";
import { useClientList } from "@/lib/list/use-client-list";
import { formatDateTime } from "@/lib/format";
import { markAllNotificationsReadAction } from "@/lib/actions/users";
import { MarkReadButton } from "@/components/notifications/MarkReadButton";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationsBoard({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const unread = notifications.filter((n) => !n.read).length;

  const list = useClientList({
    items: notifications,
    getSearchValues: (n) => [n.title, n.body],
    getSortValue: (n, key) => {
      if (key === "date") return new Date(n.createdAt);
      if (key === "title") return n.title;
      return n.createdAt;
    },
    initialSort: "date",
    initialDir: "desc",
  });

  function markAll() {
    start(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Сповіщення"
        description={
          unread > 0
            ? `${unread} непрочитаних`
            : "Усі сповіщення прочитані"
        }
        actions={
          unread > 0 ? (
            <button
              type="button"
              disabled={pending}
              onClick={markAll}
              className="ui-btn ui-btn-secondary"
            >
              Позначити всі прочитаними
            </button>
          ) : null
        }
      />

      <Panel className="overflow-hidden p-0">
        <ListToolbar
          q={list.q}
          onSearch={list.setSearch}
          pageSize={list.pageSize}
          onPageSize={list.setPageSize}
          searchPlaceholder="Пошук сповіщень…"
        />

        <ul className="divide-y divide-border">
          {list.pageItems.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-text-muted">
              Сповіщень немає
            </li>
          ) : (
            list.pageItems.map((n) => (
              <li
                key={n.id}
                className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5 ${
                  !n.read ? "bg-accent-soft/30" : ""
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    {!n.read ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    ) : null}
                    <p className="font-medium text-text">{n.title}</p>
                  </div>
                  {n.body ? (
                    <p className="mt-1 text-[13px] text-text-muted">{n.body}</p>
                  ) : null}
                  <p className="mt-1 text-[12px] text-text-muted">
                    {formatDateTime(n.createdAt)}
                  </p>
                </div>
                {!n.read ? <MarkReadButton id={n.id} /> : null}
              </li>
            ))
          )}
        </ul>

        <DataPagination
          page={list.page}
          pageCount={list.pageCount}
          total={list.total}
          pageSize={list.pageSize}
          onPage={list.setPage}
        />
      </Panel>
    </div>
  );
}
