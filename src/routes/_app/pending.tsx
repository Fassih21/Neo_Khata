import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingList, PageHeader } from "@/components/clinic/states";
import { fillTemplate, fmtDate, formatRs, waLink } from "@/lib/format";
import { useClinicSettings, useLogReminder, usePendingList, type PendingRow } from "@/lib/hooks";

export const Route = createFileRoute("/_app/pending")({ component: Pending });

type Sort = "high" | "old";
type Filter = "all" | "never" | "7d";

function Pending() {
  const q = usePendingList();
  const clinic = useClinicSettings();
  const log = useLogReminder();
  const [search, setSearch] = useState("");
  const [min, setMin] = useState("");
  const [sort, setSort] = useState<Sort>("high");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    let r = q.data ?? [];
    const s = search.trim().toLowerCase();
    if (s) r = r.filter((x) => x.full_name.toLowerCase().includes(s) || x.phone.includes(s));
    const m = Number(min);
    if (m > 0) r = r.filter((x) => x.pending_amount >= m);
    if (filter === "never") r = r.filter((x) => !x.last_reminder_at);
    if (filter === "7d") r = r.filter((x) => !x.last_reminder_at || Date.now() - new Date(x.last_reminder_at).getTime() > 7 * 864e5);
    return [...r].sort((a, b) => (sort === "high" ? b.pending_amount - a.pending_amount : (a.last_treatment_date ?? "").localeCompare(b.last_treatment_date ?? "")));
  }, [q.data, search, min, sort, filter]);

  const total = rows.reduce((s, r) => s + r.pending_amount, 0);
  const tpl = clinic.data?.whatsapp_reminder_template ?? "Your pending amount is Rs {pending_amount}.";
  const clinicName = clinic.data?.clinic_name ?? "NEO Dental Clinic";
  const msgFor = (r: PendingRow) =>
    fillTemplate(tpl, { patient_name: r.full_name, clinic_name: clinicName, pending_amount: r.pending_amount.toLocaleString("en-US") });

  const chip = (active: boolean) => `h-9 shrink-0 rounded-full border px-3 text-sm ${active ? "bg-primary text-primary-foreground" : "bg-background"}`;

  return (
    <>
      <PageHeader title="Pending amounts" />
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input className="h-11 pl-9" placeholder="Search name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button className={chip(sort === "high")} onClick={() => setSort("high")}>Highest first</button>
          <button className={chip(sort === "old")} onClick={() => setSort("old")}>Oldest visit</button>
          <button className={chip(filter === "never")} onClick={() => setFilter(filter === "never" ? "all" : "never")}>Never reminded</button>
          <button className={chip(filter === "7d")} onClick={() => setFilter(filter === "7d" ? "all" : "7d")}>Not reminded 7d</button>
        </div>
        <Input className="h-11" inputMode="numeric" placeholder="Minimum pending (Rs)" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} />
      </div>

      {q.isLoading ? (
        <LoadingList />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing pending" hint="All matching patients have cleared their balance" />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {rows.length} patients · {formatRs(total)}
          </p>
          <ul className="space-y-3">
            {rows.map((r) => {
              const link = waLink(r.phone, msgFor(r));
              return (
                <li key={r.patient_id}>
                  <Card>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <Link to="/patients/$id" params={{ id: r.patient_id }} className="min-w-0">
                          <p className="truncate font-medium">{r.full_name}</p>
                          <p className="text-sm text-muted-foreground">{r.phone}</p>
                        </Link>
                        <Badge variant="destructive">{formatRs(r.pending_amount)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {r.last_reminder_at ? `Reminded ${fmtDate(r.last_reminder_at)} (${r.reminder_count}×)` : "Never reminded"}
                      </p>
                      <div className="flex gap-2">
                        {link ? (
                          <Button asChild className="h-11 flex-1">
                            <a href={link} target="_blank" rel="noopener noreferrer">
                              <MessageCircle className="h-4 w-4" /> WhatsApp
                            </a>
                          </Button>
                        ) : (
                          <Button className="h-11 flex-1" disabled>
                            Invalid number
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="h-11 flex-1"
                          disabled={log.isPending}
                          onClick={() => log.mutate({ patient_id: r.patient_id, pending_amount: r.pending_amount, message: msgFor(r) })}
                        >
                          <CheckCircle2 className="h-4 w-4" /> Mark sent
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
