"use client";

import { useEffect, useState, useTransition } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import {
  getOperationAuditTimelineAction,
  type OperationAuditEvent,
} from "@/lib/actions/operations";
import {
  formatDateTime,
  formatMoney,
  formatSignedMoney,
} from "@/lib/format";
import {
  TRANSACTION_TYPE_LABELS,
  type TransactionType,
} from "@/lib/types/domain";
import type { HistoryOperation } from "@/components/history/HistoryBoard";

const KIND_LABEL: Record<OperationAuditEvent["actionKind"], string> = {
  created: "Створення",
  edited: "Редагування",
  archived: "Архівування",
  unarchived: "Розархівування",
  deleted: "Видалення",
  other: "Подія",
};

function LegsCompare({
  before,
  after,
}: {
  before?: { walletName: string; currencyCode: string; amount: number }[];
  after?: { walletName: string; currencyCode: string; amount: number }[];
}) {
  if (!before?.length && !after?.length) return null;
  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2">
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
          Було
        </p>
        <ul className="space-y-0.5 font-mono-num text-[12px]">
          {(before ?? []).map((l, i) => (
            <li key={`b-${i}`}>
              {l.walletName}: {formatSignedMoney(l.amount)} {l.currencyCode}
            </li>
          ))}
          {!before?.length ? (
            <li className="text-text-muted">—</li>
          ) : null}
        </ul>
      </div>
      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
          Стало
        </p>
        <ul className="space-y-0.5 font-mono-num text-[12px]">
          {(after ?? []).map((l, i) => (
            <li key={`a-${i}`}>
              {l.walletName}: {formatSignedMoney(l.amount)} {l.currencyCode}
            </li>
          ))}
          {!after?.length ? (
            <li className="text-text-muted">—</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

export function HistoryRowDetails({
  operation,
}: {
  operation: HistoryOperation;
}) {
  const [events, setEvents] = useState<OperationAuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [openEditIds, setOpenEditIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    start(async () => {
      setError(null);
      const res = await getOperationAuditTimelineAction(operation.id);
      if (!res.ok) {
        setError("Не вдалося завантажити аудит");
        return;
      }
      setEvents(res.events);
    });
  }, [operation.id]);

  return (
    <div className="space-y-4 px-3 py-3 text-[13px]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Тип
          </p>
          <p className="font-medium">
            {TRANSACTION_TYPE_LABELS[operation.type as TransactionType]}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Контрагент
          </p>
          <p>{operation.counterpartyLabel}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Автор запису
          </p>
          <p>{operation.createdByName}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Курс
          </p>
          <p className="font-mono-num">
            {operation.rate != null ? formatMoney(operation.rate, 4) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Прибуток
          </p>
          <p className="font-mono-num">
            {operation.profit != null ? formatMoney(operation.profit, 4) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Статус
          </p>
          <p>{operation.archived ? "В архіві" : "Активна"}</p>
        </div>
      </div>

      {operation.note ? (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Примітка
          </p>
          <p className="text-text-muted">{operation.note}</p>
        </div>
      ) : null}

      {operation.archived && operation.archiveComment ? (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Коментар архіву
          </p>
          <p className="text-warning">{operation.archiveComment}</p>
        </div>
      ) : null}

      <div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
          Каси зараз
        </p>
        <ul className="w-auto space-y-0.5">
          {operation.legs.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-baseline gap-x-3 font-mono-num text-[12px]"
            >
              <span className="min-w-[8rem] font-sans font-medium text-text">
                {l.walletName}
              </span>
              <span
                className={
                  l.amount < 0
                    ? "text-danger"
                    : l.amount > 0
                      ? "text-success"
                      : "text-text"
                }
              >
                {formatSignedMoney(l.amount)}
              </span>
              {l.rateUsd != null ? (
                <span className="text-text-muted">
                  курс {formatMoney(l.rateUsd, 4)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-text-muted">
          Аудит (хронологія)
        </p>
        {pending && !events ? (
          <p className="text-[12px] text-text-muted">Завантаження…</p>
        ) : null}
        {error ? <p className="text-[12px] text-danger">{error}</p> : null}
        {events && events.length === 0 ? (
          <p className="text-[12px] text-text-muted">
            Записів аудиту ще немає (старі операції могли бути без детального
            логу).
          </p>
        ) : null}
        {events && events.length > 0 ? (
          <ol className="space-y-2 border-l border-border pl-3">
            {events.map((ev) => {
              const canExpand =
                (ev.actionKind === "edited" || ev.actionKind === "created") &&
                Boolean(
                  ev.meta?.beforeLegs?.length || ev.meta?.afterLegs?.length,
                );
              const open = Boolean(openEditIds[ev.id]);
              return (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-accent" />
                  <div className="rounded-[var(--radius)] border border-border bg-surface px-2.5 py-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <span className="font-medium text-text">
                          {KIND_LABEL[ev.actionKind]}
                        </span>
                        <span className="text-text-muted">
                          {" "}
                          · {ev.actorName}
                        </span>
                      </div>
                      <time className="text-[11px] text-text-muted">
                        {formatDateTime(ev.createdAt)}
                      </time>
                    </div>
                    <p className="mt-0.5 text-[12px] text-text-muted">
                      {ev.action}
                      {ev.comment ? ` — ${ev.comment}` : ""}
                    </p>
                    {canExpand ? (
                      <button
                        type="button"
                        className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
                        onClick={() =>
                          setOpenEditIds((prev) => ({
                            ...prev,
                            [ev.id]: !prev[ev.id],
                          }))
                        }
                      >
                        {open ? (
                          <CaretDown size={12} />
                        ) : (
                          <CaretRight size={12} />
                        )}
                        {open
                          ? "Сховати каси"
                          : ev.actionKind === "edited"
                            ? "Показати зміни кас"
                            : "Показати каси"}
                      </button>
                    ) : null}
                    {open ? (
                      <LegsCompare
                        before={ev.meta?.beforeLegs}
                        after={ev.meta?.afterLegs}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </div>
  );
}
