"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { DayJournal, type JournalData, type JournalRow } from "@/components/journal/DayJournal";
import { JournalEditModal } from "@/components/journal/JournalEditModal";
import {
  NewOperationModal,
  type OpFormData,
} from "@/components/operations/NewOperationModal";
import { formatDate } from "@/lib/format";

export function JournalPageClient({
  data,
  counterparties,
  opForm,
  dateStr,
  canCreate,
  autoOpen,
  initialCounterpartyId,
}: {
  data: JournalData;
  counterparties: { id: string; name: string }[];
  opForm: OpFormData;
  dateStr: string;
  canCreate: boolean;
  autoOpen?: boolean;
  initialCounterpartyId?: string;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<JournalRow | null>(null);

  useEffect(() => {
    if (autoOpen && canCreate) setModalOpen(true);
  }, [autoOpen, canCreate]);

  function navigateDate(next: string) {
    router.push(`/work/journal?date=${next}`);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Журнал дня"
        description={`${formatDate(dateStr)} · ${data.branchName}`}
        actions={
          canCreate ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="ui-btn ui-btn-primary"
            >
              <Plus size={16} weight="bold" />
              Додати операцію
            </button>
          ) : null
        }
      />

      <Panel className="overflow-hidden p-0">
        <form
          className="flex flex-wrap items-end gap-2 border-b border-border px-3 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const d = String(fd.get("date") ?? dateStr);
            navigateDate(d);
          }}
        >
          <div>
            <label htmlFor="journal-date" className="ui-label">
              Дата
            </label>
            <input
              id="journal-date"
              name="date"
              type="date"
              defaultValue={dateStr}
              className="ui-input w-auto"
            />
          </div>
          <button type="submit" className="ui-btn ui-btn-secondary">
            Показати
          </button>
        </form>

        <DayJournal
          data={data}
          canEdit={canCreate}
          onEdit={(row) => setEditRow(row)}
        />
      </Panel>

      <NewOperationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        opForm={opForm}
        defaultDate={dateStr}
        defaultCounterpartyId={initialCounterpartyId}
      />

      <JournalEditModal
        row={editRow}
        wallets={opForm.wallets}
        counterparties={counterparties}
        expenseCategories={opForm.expenseCategories ?? []}
        onClose={() => setEditRow(null)}
      />
    </div>
  );
}
