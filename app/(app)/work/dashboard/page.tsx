import { DailyProfitChart } from "@/components/dashboard/DailyProfitChart";
import { loadDailyProfitSeries } from "@/lib/data/day-summary";

export const dynamic = "force-dynamic";

function toISOLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayLocal() {
  return toISOLocal(new Date());
}

function startOfCurrentMonth() {
  const now = new Date();
  return toISOLocal(new Date(now.getFullYear(), now.getMonth(), 1));
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;

  let from: string;
  let to: string;

  if (params.from && params.to) {
    from = params.from <= params.to ? params.from : params.to;
    to = params.from <= params.to ? params.to : params.from;
  } else if (params.date) {
    from = params.date;
    to = params.date;
  } else {
    from = startOfCurrentMonth();
    to = todayLocal();
  }

  const isRange = from !== to;
  const series = await loadDailyProfitSeries(from, to);

  return (
    <DailyProfitChart
      series={series}
      dateFrom={from}
      dateTo={to}
      isRange={isRange}
    />
  );
}
