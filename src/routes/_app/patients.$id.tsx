import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, Pencil, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState, ErrorState, LoadingList } from "@/components/clinic/states";
import { PatientDialog } from "@/components/clinic/patient-form";
import { PaymentDialog, TreatmentDialog } from "@/components/clinic/treatment-payment";
import { ReceiptDialog } from "@/components/clinic/receipt-dialog";
import { fillTemplate, fmtDate, formatRs, waLink } from "@/lib/format";
import { useClinicSettings, useDeletePatient, useDeletePayment, useDeleteTreatment, useLogReminder, usePatientDetail, type Treatment } from "@/lib/hooks";

export const Route = createFileRoute("/_app/patients/$id")({ component: PatientPage });

function PatientPage() {
  const { id } = Route.useParams();
  const { role } = Route.useRouteContext();
  const owner = role === "owner";
  const nav = useNavigate();
  const q = usePatientDetail(id);
  const clinic = useClinicSettings();
  const delPatient = useDeletePatient();
  const delTreatment = useDeleteTreatment(id);
  const delPayment = useDeletePayment(id);
  const logReminder = useLogReminder();

  const [editPatient, setEditPatient] = useState(false);
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [editing, setEditing] = useState<Treatment | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payFor, setPayFor] = useState<string | undefined>();
  const [receiptFor, setReceiptFor] = useState<Treatment | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: "patient" | "treatment" | "payment"; id: string }>(null);

  if (q.isLoading) return <LoadingList />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data!;
  const p = d.patient;
  if (!p) return <EmptyState title="Patient not found" action={<Button asChild variant="outline"><Link to="/patients">Back</Link></Button>} />;

  const clinicName = clinic.data?.clinic_name ?? "NEO Dental Clinic";
  const reminderMsg = fillTemplate(clinic.data?.whatsapp_reminder_template ?? "Your pending amount is Rs {pending_amount}.", {
    patient_name: p.full_name,
    clinic_name: clinicName,
    pending_amount: d.balance.pending.toLocaleString("en-US"),
  });
  const reminderLink = d.balance.pending > 0 ? waLink(p.phone, reminderMsg) : null;

  const doDelete = () => {
    if (!confirm) return;
    const done = () => setConfirm(null);
    if (confirm.kind === "patient") delPatient.mutate(p.id, { onSuccess: () => nav({ to: "/patients" }) });
    if (confirm.kind === "treatment") delTreatment.mutate(confirm.id, { onSettled: done });
    if (confirm.kind === "payment") delPayment.mutate(confirm.id, { onSettled: done });
  };

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-10">
        <Link to="/patients">
          <ArrowLeft className="h-4 w-4" /> Patients
        </Link>
      </Button>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">{p.full_name}</h1>
              <a href={`tel:${p.phone}`} className="text-sm text-muted-foreground underline">
                {p.phone}
              </a>
              <p className="text-xs text-muted-foreground">
                {[p.age ? `${p.age} yrs` : null, p.gender, p.address].filter(Boolean).join(" · ")}
              </p>
              {p.notes && <p className="mt-1 text-sm">{p.notes}</p>}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="icon" variant="outline" className="h-11 w-11" onClick={() => setEditPatient(true)} aria-label="Edit patient">
                <Pencil className="h-4 w-4" />
              </Button>
              {owner && (
                <Button size="icon" variant="outline" className="h-11 w-11" onClick={() => setConfirm({ kind: "patient", id: p.id })} aria-label="Delete patient">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Tot l="Total" v={formatRs(d.balance.billed)} />
            <Tot l="Paid" v={formatRs(d.balance.paid)} good />
            <Tot l="Pending" v={formatRs(d.balance.pending)} bad={d.balance.pending > 0} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button className="h-11" onClick={() => { setPayFor(undefined); setPayOpen(true); }} disabled={d.balance.pending <= 0}>
              <Wallet className="h-4 w-4" /> Receive payment
            </Button>
            {reminderLink ? (
              <Button asChild variant="outline" className="h-11">
                <a
                  href={reminderLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logReminder.mutate({ patient_id: p.id, pending_amount: d.balance.pending, message: reminderMsg })}
                >
                  <MessageCircle className="h-4 w-4" /> Remind
                </a>
              </Button>
            ) : (
              <Button variant="outline" className="h-11" disabled>
                <MessageCircle className="h-4 w-4" /> Remind
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Treatments</h2>
          <Button size="sm" className="h-10" onClick={() => { setEditing(null); setTreatmentOpen(true); }}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        {d.treatments.length === 0 ? (
          <EmptyState title="No treatments yet" />
        ) : (
          d.treatments.map((t) => {
            const b = d.treatmentBalance(t.id);
            return (
              <Card key={t.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{t.services?.name ?? t.description ?? "Treatment"}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(t.treatment_date)}</p>
                      {t.services && t.description && <p className="text-sm">{t.description}</p>}
                    </div>
                    <Badge variant={t.status === "completed" ? "secondary" : "outline"} className="capitalize">
                      {t.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-sm">
                    <span>Net {formatRs(b.net)}</span>
                    {t.discount > 0 && <span className="text-muted-foreground">(disc. {formatRs(t.discount)})</span>}
                    <span className="text-emerald-600">Paid {formatRs(b.paid)}</span>
                    <span className={b.pending > 0 ? "font-medium text-destructive" : "text-muted-foreground"}>Pending {formatRs(b.pending)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-10 flex-1" onClick={() => setReceiptFor(t)}>
                      <Receipt className="h-4 w-4" /> Receipt
                    </Button>
                    {b.pending > 0 && (
                      <Button size="sm" variant="outline" className="h-10 flex-1" onClick={() => { setPayFor(t.id); setPayOpen(true); }}>
                        <Wallet className="h-4 w-4" /> Pay
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => { setEditing(t); setTreatmentOpen(true); }} aria-label="Edit treatment">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {owner && b.paid === 0 && (
                      <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => setConfirm({ kind: "treatment", id: t.id })} aria-label="Delete treatment">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Payments</h2>
        {d.payments.length === 0 ? (
          <EmptyState title="No payments yet" />
        ) : (
          d.payments.map((y) => {
            const t = d.treatments.find((x) => x.id === y.treatment_id);
            return (
              <Card key={y.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{formatRs(y.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(y.payment_date)} · <span className="capitalize">{y.method}</span>
                      {t ? ` · ${t.services?.name ?? t.description ?? "Treatment"}` : ""}
                    </p>
                    {y.note && <p className="text-xs">{y.note}</p>}
                  </div>
                  {owner && (
                    <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => setConfirm({ kind: "payment", id: y.id })} aria-label="Delete payment">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <PatientDialog open={editPatient} onOpenChange={setEditPatient} patient={p} />
      <TreatmentDialog open={treatmentOpen} onOpenChange={setTreatmentOpen} patientId={p.id} treatment={editing} />
      <PaymentDialog
        key={payFor ?? "general"}
        open={payOpen}
        onOpenChange={setPayOpen}
        patientId={p.id}
        treatments={d.treatments}
        pendingOf={(tid) => d.treatmentBalance(tid).pending}
        defaultTreatmentId={payFor}
        patientPending={d.balance.pending}
      />
      <ReceiptDialog
        open={!!receiptFor}
        onOpenChange={(o) => !o && setReceiptFor(null)}
        clinicName={clinicName}
        patient={p}
        treatment={receiptFor}
        payments={d.payments.filter((y) => y.treatment_id === receiptFor?.id)}
        net={receiptFor ? d.treatmentBalance(receiptFor.id).net : 0}
        paid={receiptFor ? d.treatmentBalance(receiptFor.id).paid : 0}
        pending={receiptFor ? d.treatmentBalance(receiptFor.id).pending : 0}
      />
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {confirm?.kind}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "patient" ? "All treatments and payments of this patient will be deleted too. " : ""}This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={doDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Tot({ l, v, good, bad }: { l: string; v: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/60 p-2">
      <p className="text-[11px] text-muted-foreground">{l}</p>
      <p className={`text-sm font-semibold tabular-nums ${good ? "text-emerald-600" : ""} ${bad ? "text-destructive" : ""}`}>{v}</p>
    </div>
  );
}
