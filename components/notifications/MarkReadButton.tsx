"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markNotificationReadAction } from "@/lib/actions/users";

export function MarkReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        start(async () => {
          await markNotificationReadAction(id);
          router.refresh();
        });
      }}
      className="ui-btn ui-btn-ghost h-7 px-2 text-[12px]"
    >
      Прочитано
    </button>
  );
}
