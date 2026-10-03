"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import {
  archiveOperationAction,
  deleteOperationAction,
  getDeleteOperationPreviewAction,
  unarchiveOperationAction,
  type DeleteOperationPreview,
} from "@/lib/actions/operations";
import { formatSignedMoney } from "@/lib/format";

type PreviewOk = Extract<DeleteOperationPreview, { ok: true }>;

export function HistoryActions({
  id,
  archived,
  canArchive,
  canDelete,
  canEdit,
  onEdit,
}: {
  id: string;
  archived: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewOk | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!canArchive && !canDelete && !canEdit) return null;

  function handleArchive() {
    const comment = window.prompt("Коментар для архіву:");
    if (!comment?.trim()) return;

    start(async () => {
      const result = await archiveOperationAction(id, comment.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleUnarchive() {
    start(async () => {
      setError(null);
      const result = await unarchiveOperationAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function openDeleteModal() {
    setError(null);
    setPreview(null);
    setPreviewLoading(true);
    start(async () => {
      const result = await getDeleteOperationPreviewAction(id);
      setPreviewLoading(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(result);
    });
  }

  function confirmDelete() {
    if (!preview || preview.blockers.length > 0) return;
    start(async () => {
      const result = await deleteOperationAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        {canEdit && onEdit ? (
          <button
            type="button"
            disabled={pending}
            onClick={onEdit}
            className="ui-btn ui-btn-ghost h-7 px-2 text-[12px]"
          >
            Змінити
          </button>
        ) : null}
        {canArchive && !archived ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleArchive}
            className="ui-btn ui-btn-ghost h-7 px-2 text-[12px]"
          >
            Архів
          </button>
        ) : null}
        {canArchive && archived ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleUnarchive}
            className="ui-btn ui-btn-ghost h-7 px-2 text-[12px]"
          >
            З архіву
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            disabled={pending || previewLoading}
            onClick={openDeleteModal}
            className="ui-btn ui-btn-danger h-7 px-2 text-[12px]"
          >
            Видалити
          </button>
        ) : null}
        {error && !preview ? (
          <span className="text-[11px] text-danger">{error}</span>
        ) : null}
      </div>

      {mounted &&
        (previewLoading || preview) &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
            onClick={() => {
              if (pending) return;
              setPreview(null);
              setPreviewLoading(false);
            }}
          >
            <div
              className="ui-panel flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden bg-[var(--surface)] shadow-lg sm:rounded-[var(--radius)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-op-title"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2
                id="delete-op-title"
                className="text-[15px] font-semibold text-text"
              >
                Видалити операцію?
              </h2>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setPreview(null);
                  setPreviewLoading(false);
                }}
                className="ui-btn ui-btn-ghost h-8 w-8 p-0"
                aria-label="Закрити"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-3 text-[13px]">
              {previewLoading && !preview ? (
                <p className="text-text-muted">Рахуємо наслідки…</p>
              ) : preview ? (
                <div className="space-y-3">
                  <p className="text-text-muted">
                    Тип:{" "}
                    <span className="font-medium text-text">
                      {preview.typeLabel}
                    </span>
                    {preview.counterpartyLabel ? (
                      <>
                        {" · "}
                        контрагент:{" "}
                        <span className="font-medium text-text">
                          {preview.counterpartyLabel}
                        </span>
                      </>
                    ) : null}
                    . Дію не можна скасувати.
                  </p>

                  {preview.balancesWillChange &&
                  preview.walletEffects.length > 0 ? (
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                        Зміна залишків кас
                      </p>
                      <ul className="space-y-1.5 rounded-[var(--radius)] border border-border bg-surface-2 px-3 py-2">
                        {preview.walletEffects.map((w, i) => (
                          <li
                            key={`${w.walletName}-${i}`}
                            className="flex items-baseline justify-between gap-3"
                          >
                            <span className="text-text">{w.walletName}</span>
                            <span
                              className={`font-mono-num font-medium ${
                                w.delta > 0
                                  ? "text-success"
                                  : w.delta < 0
                                    ? "text-danger"
                                    : "text-text-muted"
                              }`}
                            >
                              {formatSignedMoney(w.delta)} {w.currencyCode}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1.5 text-[12px] text-text-muted">
                        Відкат руху: з якої каси пішло — повернеться, куди
                        зайшло — зніметься.
                      </p>
                    </div>
                  ) : null}

                  {preview.debtEffects.length > 0 ? (
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                        Вплив на борги
                      </p>
                      <ul className="space-y-2">
                        {preview.debtEffects.map((d) => (
                          <li
                            key={`${d.kind}-${d.debtId}`}
                            className="rounded-[var(--radius)] border border-border bg-surface-2 px-3 py-2 text-text"
                          >
                            {d.summary}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {preview.willDeleteJournal ? (
                    <p className="rounded-[var(--radius)] border border-border bg-surface-2 px-3 py-2 text-text">
                      Буде також видалено пов’язаний запис у журналі.
                    </p>
                  ) : null}

                  {preview.warnings.map((w) => (
                    <p
                      key={w}
                      className="rounded-[var(--radius)] border border-border px-3 py-2 text-text-muted"
                    >
                      {w}
                    </p>
                  ))}

                  {preview.blockers.map((b) => (
                    <p
                      key={b}
                      className="rounded-[var(--radius)] border border-danger/40 bg-[color-mix(in_oklab,var(--danger)_8%,var(--surface))] px-3 py-2 text-danger"
                    >
                      {b}
                    </p>
                  ))}

                  {error ? (
                    <p className="text-[12px] text-danger">{error}</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setPreview(null);
                  setPreviewLoading(false);
                }}
                className="ui-btn ui-btn-ghost"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={
                  pending ||
                  previewLoading ||
                  !preview ||
                  preview.blockers.length > 0
                }
                onClick={confirmDelete}
                className="ui-btn ui-btn-danger"
              >
                {pending ? "…" : "Видалити остаточно"}
              </button>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
