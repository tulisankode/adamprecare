"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { PhoneIncoming, PhoneOff } from "lucide-react";
import { PageCard } from "@/components/ui/page-card";
import { DateRangeInputs } from "@/components/ui/fields";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useDashboardByCaseType, useDashboardDaily, useDashboardSummary } from "@/lib/queries";
import { currentMonthRange } from "@/lib/format";
import { errorMessage } from "@/lib/api";

const TopCasesDonut = dynamic(() => import("@/components/dashboard/charts").then((m) => m.TopCasesDonut), {
  ssr: false,
  loading: () => <Skeleton className="mx-auto size-[250px] rounded-full" />,
});
const DailyCallsChart = dynamic(() => import("@/components/dashboard/charts").then((m) => m.DailyCallsChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[300px] w-full" />,
});

function StatCard({ title, value, unit, icon }: { title: string; value?: number; unit: string; icon: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-lg bg-primary px-5 py-6 text-white">
      <p className="text-lg font-medium">{title}</p>
      <div className="mt-4 flex items-baseline gap-3">
        {value === undefined ? (
          <Skeleton className="h-10 w-16 bg-white/40" />
        ) : (
          <span className="text-5xl leading-none font-medium">{value}</span>
        )}
        <span className="text-base">{unit}</span>
      </div>
      <span className="pointer-events-none absolute -right-3 -bottom-5 text-white/20" aria-hidden>
        {icon}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState(currentMonthRange);
  const validRange = !!range.from && !!range.to && range.from <= range.to;
  const effective = validRange ? range : currentMonthRange();

  const summary = useDashboardSummary(effective);
  const byCase = useDashboardByCaseType(effective);
  const daily = useDashboardDaily(effective);

  const refreshing = summary.isFetching || byCase.isFetching || daily.isFetching;
  const refresh = () => {
    void summary.refetch();
    void byCase.refetch();
    void daily.refetch();
  };

  const hasDaily = !!daily.data && daily.data.dates.length > 0 && daily.data.series.length > 0;

  return (
    <div className="flex flex-col gap-2.5">
      <PageCard
        title="Dashboard"
        onRefresh={refresh}
        refreshing={refreshing}
        headerRight={
          <div className="w-full sm:w-auto sm:min-w-[360px]">
            <DateRangeInputs from={range.from} to={range.to} onChange={setRange} idPrefix="dash" />
          </div>
        }
      />
      {!validRange && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-2 text-xs text-danger">
          Rentang tanggal tidak valid. Menampilkan data bulan berjalan.
        </p>
      )}

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section className="rounded-lg bg-white p-5 shadow-card" aria-labelledby="rekap-title">
          <h2 id="rekap-title" className="border-b border-divider pb-3 text-base font-medium text-ink">
            Rekapitulasi Panggilan Darurat
          </h2>
          {summary.isError ? (
            <ErrorState message={errorMessage(summary.error)} onRetry={() => summary.refetch()} />
          ) : (
            <div className="mt-4 flex flex-col gap-5">
              <StatCard
                title="Total Panggilan Masuk"
                value={summary.data?.total_calls}
                unit="Panggilan"
                icon={<PhoneIncoming className="size-28" strokeWidth={2.2} />}
              />
              <StatCard
                title="Total Pembatalan Panggilan"
                value={summary.data?.total_cancelled}
                unit="Pembatalan"
                icon={<PhoneOff className="size-28" strokeWidth={2.2} />}
              />
            </div>
          )}
        </section>

        <section className="rounded-lg bg-white p-5 shadow-card" aria-labelledby="top5-title">
          <h2 id="top5-title" className="border-b border-divider pb-3 text-center text-base font-medium text-ink">
            Top 5 Kasus
          </h2>
          <div className="mt-6">
            {byCase.isLoading ? (
              <Skeleton className="mx-auto size-[250px] rounded-full" />
            ) : byCase.isError ? (
              <ErrorState message={errorMessage(byCase.error)} onRetry={() => byCase.refetch()} />
            ) : !byCase.data || byCase.data.every((d) => d.count === 0) ? (
              <EmptyState title="Belum ada panggilan" description="Tidak ada panggilan pada rentang tanggal ini." />
            ) : (
              <TopCasesDonut data={byCase.data.filter((d) => d.count > 0)} />
            )}
          </div>
        </section>
      </div>

      <section className="rounded-lg bg-white p-5 shadow-card" aria-labelledby="grafik-title">
        <h2 id="grafik-title" className="border-b border-divider pb-3 text-base font-medium text-ink">
          Grafik Total Panggilan
        </h2>
        <div className="mt-6">
          {daily.isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : daily.isError ? (
            <ErrorState message={errorMessage(daily.error)} onRetry={() => daily.refetch()} />
          ) : !hasDaily ? (
            <EmptyState title="Belum ada data grafik" description="Tidak ada panggilan pada rentang tanggal ini." />
          ) : (
            <DailyCallsChart data={daily.data!} />
          )}
        </div>
      </section>
    </div>
  );
}
