"use client";

import { useTransition } from "react";
import { updateWalletColorAction } from "@/lib/actions/entities";

export function WalletColorPicker({
  walletId,
  color,
}: {
  walletId: string;
  color: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        startTransition(() => updateWalletColorAction(fd));
      }}
      className="shrink-0"
    >
      <input type="hidden" name="walletId" value={walletId} />
      <input
        name="color"
        type="color"
        defaultValue={color}
        title="Змінити колір"
        aria-label="Колір каси"
        disabled={pending}
        className="h-10 w-10 cursor-pointer rounded-[var(--radius-control)] border border-border bg-transparent p-0 disabled:opacity-60 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[calc(var(--radius-control)-1px)] [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-[calc(var(--radius-control)-1px)] [&::-moz-color-swatch]:border-0"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
    </form>
  );
}
