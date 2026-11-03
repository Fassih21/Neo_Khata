import { MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { fmtDate, formatRs, waLink } from "@/lib/format";
import type { Patient, Payment, Treatment } from "@/lib/hooks";

export function ReceiptDialog({
  open,
  onOpenChange,
  clinicName,
  patient,
  treatment,
  payments,
  net,
  paid,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clinicName: string;
  patient: Patient;
  treatment: Treatment | null;
  payments: Payment[];
  net: number;
  paid: number;
  pending: number;
}) {
  if (!treatment) return null;
  const title = treatment.services?.name ?? treatment.description ?? "Treatment";
  const msg =
    `${clinicName}\nReceipt — ${patient.full_name}\n${title} (${fmtDate(treatment.treatment_date)})\n` +
    `Billed: ${formatRs(treatment.total_amount)}${treatment.discount > 0 ? `\nDiscount: ${formatRs(treatment.discount)}` : ""}\n` +
    `Paid: ${formatRs(paid)}\nPending: ${formatRs(pending)}`;
  const link = waLink(patient.phone, msg);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receipt</DialogTitle>
        </DialogHeader>
        <div id="receipt" className="space-y-3 text-sm">
          <div className="text-center">
            <p className="font-semibold">{clinicName}</p>
            <p className="text-xs text-muted-foreground">{fmtDate(treatment.treatment_date)}</p>
          </div>
          <Separator />
          <Row l="Patient" r={patient.full_name} />
          <Row l="Service" r={title} />
          <Row l="Amount" r={formatRs(treatment.total_amount)} />
          {treatment.discount > 0 && <Row l="Discount" r={`- ${formatRs(treatment.discount)}`} />}
          <Row l="Net bill" r={formatRs(net)} bold />
          <Separator />
          {payments.length === 0 ? (
            <p className="text-muted-foreground">No payments yet</p>
          ) : (
            payments.map((p) => <Row key={p.id} l={`${fmtDate(p.payment_date)} · ${p.method}`} r={formatRs(p.amount)} />)
          )}
          <Separator />
          <Row l="Total paid" r={formatRs(paid)} bold />
          <Row l="Pending" r={formatRs(pending)} bold />
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" className="h-11 flex-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          {link && (
            <Button asChild className="h-11 flex-1">
              <a href={link} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{l}</span>
      <span className="text-right">{r}</span>
    </div>
  );
}
