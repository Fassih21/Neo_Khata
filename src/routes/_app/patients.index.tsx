import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingList, PageHeader } from "@/components/clinic/states";
import { PatientDialog } from "@/components/clinic/patient-form";
import { usePatients } from "@/lib/hooks";
import { formatRs } from "@/lib/format";
import { useDebounced } from "@/lib/use-debounced";

export const Route = createFileRoute("/_app/patients/")({ component: Patients });

function Patients() {
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(search, 300);
  const q = usePatients(debounced);

  return (
    <>
      <PageHeader
        title="Patients"
        action={
          <Button className="h-11" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        }
      />
      <div className="relative mb-4">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input className="h-11 pl-9" placeholder="Search name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {q.isLoading ? (
        <LoadingList />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState title={debounced ? "No match" : "No patients yet"} hint={debounced ? "Try another name or number" : "Tap Add to create the first patient"} />
      ) : (
        <ul className="space-y-3">
          {q.data!.map((p) => (
            <li key={p.id}>
              <Link to="/patients/$id" params={{ id: p.id }}>
                <Card className="transition-colors active:bg-accent">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.full_name}</p>
                      <p className="text-sm text-muted-foreground">{p.phone}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>Billed {formatRs(p.total_billed)}</span>
                        <span>Paid {formatRs(p.total_paid)}</span>
                      </div>
                    </div>
                    {p.pending_amount > 0 ? (
                      <Badge variant="destructive" className="shrink-0">
                        {formatRs(p.pending_amount)}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="shrink-0">
                        Clear
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <PatientDialog open={open} onOpenChange={setOpen} onSaved={(id) => nav({ to: "/patients/$id", params: { id } })} />
    </>
  );
}
