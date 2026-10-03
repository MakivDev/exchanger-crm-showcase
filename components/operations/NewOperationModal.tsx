"use client";

import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { NewOperationForm } from "@/components/operations/NewOperationForm";
import type { TransactionType } from "@/lib/types/domain";

type Wallet = {
  id: string;
  name: string;
  currencyCode: string;
  balance?: number;
  lastRateUsd?: number | null;
};
type Counterparty = { id: string; name: string; temporary?: boolean };
type ExpenseCategory = { id: string; name: string };

export type OpFormData = {
  wallets: Wallet[];
  counterparties: Counterparty[];
  expenseCategories?: ExpenseCategory[];
  recommendedRates: Record<string, number>;
  lastRates?: Record<string, number>;
};

export function NewOperationModal({
  open,
  onClose,
  opForm,
  defaultType = "buy",
  defaultCounterpartyId,
  defaultDate,
  allowedTypes,
  title = "Нова операція",
}: {
  open: boolean;
  onClose: () => void;
  opForm: OpFormData;
  defaultType?: TransactionType;
  defaultCounterpartyId?: string;
  defaultDate?: string;
  allowedTypes?: TransactionType[];
  title?: string;
}) {
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    setVisible(open);
  }, [open]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div
        className="ui-panel w-full max-w-lg shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-op-title"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="new-op-title" className="text-[15px] font-semibold text-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ui-btn ui-btn-ghost h-8 w-8 p-0"
            aria-label="Закрити"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4">
          <NewOperationForm
            wallets={opForm.wallets}
            counterparties={opForm.counterparties}
            expenseCategories={opForm.expenseCategories ?? []}
            recommendedRates={opForm.recommendedRates}
            defaultType={defaultType}
            defaultCounterpartyId={defaultCounterpartyId}
            defaultDate={defaultDate}
            allowedTypes={allowedTypes}
            onSuccess={onClose}
            embedded
          />
        </div>
      </div>
    </div>
  );
}
