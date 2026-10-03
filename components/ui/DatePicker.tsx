"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatUk(iso: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parseISO(iso));
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysInCalendar(month: Date): Date[] {
  const first = startOfMonth(month);
  // Monday-first
  const weekday = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - weekday);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function monthTitle(d: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
    month: "long",
    year: "numeric",
  }).format(d);
}

type PopoverProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
};

function CalendarPopover({ open, onClose, anchorRef, children }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-40 mt-1.5 w-[18.5rem] rounded-[var(--radius)] border border-border bg-surface p-3 shadow-lg"
    >
      {children}
    </div>
  );
}

function MonthGrid({
  month,
  onMonthChange,
  renderDay,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  renderDay: (d: Date) => ReactNode;
}) {
  const cells = useMemo(() => daysInCalendar(month), [month]);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          className="ui-btn ui-btn-ghost h-7 w-7 p-0"
          onClick={() => onMonthChange(addMonths(month, -1))}
          aria-label="Попередній місяць"
        >
          <CaretLeft size={14} />
        </button>
        <div className="text-[13px] font-medium capitalize text-text">
          {monthTitle(month)}
        </div>
        <button
          type="button"
          className="ui-btn ui-btn-ghost h-7 w-7 p-0"
          onClick={() => onMonthChange(addMonths(month, 1))}
          aria-label="Наступний місяць"
        >
          <CaretRight size={14} />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-1 text-center text-[10px] font-medium text-text-muted"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">{cells.map(renderDay)}</div>
    </div>
  );
}

export function DatePicker({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() =>
    startOfMonth(value ? parseISO(value) : new Date()),
  );
  const btnRef = useRef<HTMLButtonElement>(null);
  const selected = value ? parseISO(value) : null;
  const today = new Date();

  useEffect(() => {
    if (value) setMonth(startOfMonth(parseISO(value)));
  }, [value]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        className="ui-input flex h-8 w-auto min-w-[9.5rem] items-center gap-2 px-2.5 text-left text-[13px]"
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarBlank size={15} className="shrink-0 text-text-muted" />
        <span className="font-mono-num">{formatUk(value) || "Дата"}</span>
      </button>
      <CalendarPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
      >
        <MonthGrid
          month={month}
          onMonthChange={setMonth}
          renderDay={(d) => {
            const inMonth = d.getMonth() === month.getMonth();
            const isSel = selected ? sameDay(d, selected) : false;
            const isToday = sameDay(d, today);
            return (
              <button
                key={toISO(d)}
                type="button"
                className={`h-8 rounded-[var(--radius)] text-[12px] font-mono-num transition ${
                  isSel
                    ? "bg-accent font-medium text-accent-fg"
                    : isToday
                      ? "bg-accent-soft text-accent"
                      : inMonth
                        ? "text-text hover:bg-surface-2"
                        : "text-text-muted/50 hover:bg-surface-2"
                }`}
                onClick={() => {
                  onChange(toISO(d));
                  setOpen(false);
                }}
              >
                {d.getDate()}
              </button>
            );
          }}
        />
        <button
          type="button"
          className="ui-btn ui-btn-ghost mt-2 h-7 w-full text-[12px]"
          onClick={() => {
            onChange(toISO(today));
            setOpen(false);
          }}
        >
          Сьогодні
        </button>
      </CalendarPopover>
    </div>
  );
}

export function DateRangePicker({
  from,
  to,
  onChange,
  className = "",
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() =>
    startOfMonth(from ? parseISO(from) : new Date()),
  );
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [picking, setPicking] = useState<"from" | "to">("from");
  const [hoverISO, setHoverISO] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const today = new Date();

  useEffect(() => {
    if (!open) {
      setDraftFrom(from);
      setDraftTo(to);
      setPicking("from");
      setHoverISO(null);
    }
  }, [open, from, to]);

  const fromD = draftFrom ? parseISO(draftFrom) : null;
  const toD = draftTo ? parseISO(draftTo) : null;
  const hoverD = hoverISO ? parseISO(hoverISO) : null;

  /** End of highlighted span while choosing / hovering */
  const previewEnd = useMemo(() => {
    if (!fromD) return null;
    if (picking === "to") {
      return hoverD ?? toD ?? fromD;
    }
    return toD;
  }, [fromD, toD, hoverD, picking]);

  function pick(d: Date) {
    const iso = toISO(d);
    if (picking === "from") {
      setDraftFrom(iso);
      setDraftTo("");
      setHoverISO(null);
      setPicking("to");
      return;
    }
    if (fromD && d < fromD) {
      setDraftFrom(iso);
      setDraftTo("");
      setHoverISO(null);
      setPicking("to");
      return;
    }
    setDraftTo(iso);
    setHoverISO(null);
    onChange({ from: draftFrom || iso, to: iso });
    setOpen(false);
  }

  function inPreviewRange(d: Date): boolean {
    if (!fromD || !previewEnd) return false;
    const a = Math.min(fromD.getTime(), previewEnd.getTime());
    const b = Math.max(fromD.getTime(), previewEnd.getTime());
    const t = d.getTime();
    return t >= a && t <= b;
  }

  const previewStart = fromD;
  const previewEndIsStart =
    previewStart && previewEnd
      ? sameDay(previewStart, previewEnd)
      : false;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        className="ui-input flex h-8 w-auto min-w-[12.5rem] items-center gap-2 px-2.5 text-left text-[13px]"
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarBlank size={15} className="shrink-0 text-text-muted" />
        <span className="font-mono-num">
          {formatUk(from)} – {formatUk(to)}
        </span>
      </button>
      <CalendarPopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
      >
        <div className="mb-2 flex gap-1 text-[11px]">
          <button
            type="button"
            className={`ui-btn h-7 flex-1 text-[11px] ${
              picking === "from" ? "ui-btn-primary" : "ui-btn-secondary"
            }`}
            onClick={() => {
              setPicking("from");
              setHoverISO(null);
            }}
          >
            Від {formatUk(draftFrom) || "…"}
          </button>
          <button
            type="button"
            className={`ui-btn h-7 flex-1 text-[11px] ${
              picking === "to" ? "ui-btn-primary" : "ui-btn-secondary"
            }`}
            onClick={() => setPicking("to")}
          >
            До {formatUk(draftTo || hoverISO || "") || "…"}
          </button>
        </div>
        <div onMouseLeave={() => setHoverISO(null)}>
          <MonthGrid
            month={month}
            onMonthChange={setMonth}
            renderDay={(d) => {
              const inMonth = d.getMonth() === month.getMonth();
              const isEdgeStart = previewStart
                ? sameDay(d, previewStart)
                : false;
              const isEdgeEnd =
                previewEnd && !previewEndIsStart
                  ? sameDay(d, previewEnd)
                  : false;
              const isEdge = isEdgeStart || isEdgeEnd;
              const mid = inPreviewRange(d) && !isEdge;
              const isToday = sameDay(d, today);
              const isHovering =
                picking === "to" && hoverD ? sameDay(d, hoverD) : false;

              return (
                <button
                  key={toISO(d)}
                  type="button"
                  onMouseEnter={() => {
                    if (picking === "to" && fromD) setHoverISO(toISO(d));
                  }}
                  className={`h-8 rounded-[var(--radius)] text-[12px] font-mono-num transition-colors duration-150 ease-out ${
                    isEdge
                      ? "bg-accent font-medium text-accent-fg"
                      : mid
                        ? "bg-[color-mix(in_oklab,var(--accent)_22%,var(--surface))] text-accent"
                        : isHovering
                          ? "bg-[color-mix(in_oklab,var(--accent)_14%,var(--surface))] text-accent"
                          : isToday
                            ? "ring-1 ring-accent/40 text-text"
                            : inMonth
                              ? "text-text hover:bg-surface-2"
                              : "text-text-muted/50 hover:bg-surface-2"
                  }`}
                  onClick={() => pick(d)}
                >
                  {d.getDate()}
                </button>
              );
            }}
          />
        </div>
        <p className="mt-2 text-center text-[11px] text-text-muted">
          {picking === "from"
            ? "Оберіть початкову дату"
            : "Оберіть кінцеву дату — період підсвічується при наведенні"}
        </p>
      </CalendarPopover>
    </div>
  );
}
