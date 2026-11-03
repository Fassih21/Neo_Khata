import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonthSelect } from "@/components/clinic/month-select";
import { ErrorState, LoadingList, PageHeader } from "@/components/clinic/states";
import { formatRs, monthKey, monthLabel } from "@/lib/format";
import { useDashboard, type ManagerDash, type OwnerDash } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Stat({ label, value, tone, to }: { label: string; value: string; tone?: "good" | "bad" | "warn"; to?: "/pending" | "/employees" | "/patients" }) {
  const body = (
    <Card className="h-full">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-lg font-semibold tabular-nums sm:text-xl",
            tone === "good" && "text-emerald-600",
            tone === "bad" && "text-destructive",
            tone === "warn" && "text-amber-600",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function Dashboard() {
  const { role } = Route.useRouteContext();
  const [month, setMonth] = useState(monthKey());
  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="mb-4">
        <MonthSelect value={month} onChange={setMonth} />
      </div>
      {role === "owner" ? <Owner month={month} /> : <Manager month={month} />}
    </>
  );
}

function Owner({ month }: { month: string }) {
  const q = useDashboard<OwnerDash>("owner", month);
  if (q.isLoading) return <LoadingList rows={5} />;
  if (q.error || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  const trend = d.trend.map((t) => ({ ...t, label: monthLabel(t.month, true) }));
  const donut = [
    { name: "Collected", value: d.total_paid },
    { name: "Pending", value: d.pending_amount },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Revenue Collected" value={formatRs(d.revenue)} tone="good" />
        <Stat label="Expenses (incl. salaries)" value={formatRs(d.expenses_total)} />
        <Stat label={d.net >= 0 ? "Net Profit" : "Net Loss"} value={formatRs(d.net)} tone={d.net >= 0 ? "good" : "bad"} />
        <Stat label="Active Patients" value={String(d.active_patients)} to="/patients" />
        <Stat label="Pending Amount" value={formatRs(d.pending_amount)} tone="warn" to="/pending" />
        <Stat label="Salaries Pending" value={formatRs(d.salaries_pending)} tone="warn" to="/employees" />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Last 6 months</CardTitle>
        </CardHeader>
        <CardContent className="h-64 px-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={11} tickLine={false} />
              <YAxis fontSize={11} width={42} tickLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
              <Tooltip formatter={(v: number) => formatRs(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Paid vs Pending (all time)</CardTitle>
        </CardHeader>
        <CardContent className="h-60">
          {d.total_billed === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No billing yet</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  <Cell fill="var(--chart-2)" />
                  <Cell fill="var(--chart-5)" />
                </Pie>
                <Tooltip formatter={(v: number) => formatRs(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Revenue = payments received in the month. Expenses = expenses + salaries marked paid in the month.
      </p>
    </div>
  );
}

function Manager({ month }: { month: string }) {
  const q = useDashboard<ManagerDash>("manager", month);
  if (q.isLoading) return <LoadingList rows={3} />;
  if (q.error || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat label="Active Patients" value={String(d.active_patients)} to="/patients" />
      <Stat label="New Patients" value={String(d.new_patients)} />
      <Stat label="Treatments" value={String(d.treatments)} />
      <Stat label="Patients with Pending" value={String(d.patients_with_pending)} to="/pending" />
      <Stat label="Pending Amount" value={formatRs(d.pending_amount)} tone="warn" to="/pending" />
    </div>
  );
}
