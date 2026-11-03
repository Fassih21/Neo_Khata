import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { paymentSchema, treatmentSchema } from "@/lib/schemas";
import { useAddPayment, useSaveTreatment, useServices, type Treatment } from "@/lib/hooks";
import { formatRs, todayISO } from "@/lib/format";
import { Field } from "./patient-form";
import { Spinner } from "./states";

const selectCls = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm";

type TIn = z.input<typeof treatmentSchema>;
type TOut = z.output<typeof treatmentSchema>;

export function TreatmentDialog({
  open,
  onOpenChange,
  patientId,
  treatment,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patientId: string;
  treatment?: Treatment | null;
}) {
  const services = useServices();
  const save = useSaveTreatment(patientId);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TIn, unknown, TOut>({
    resolver: zodResolver(treatmentSchema),
    values: {
      service_id: treatment?.service_id ?? "",
      description: treatment?.description ?? "",
      treatment_date: treatment?.treatment_date ?? todayISO(),
      total_amount: treatment?.total_amount ?? 0,
      discount: treatment?.discount ?? 0,
      status: (treatment?.status as "ongoing" | "completed") ?? "ongoing",
    },
  });

  const onSubmit = (v: TOut) =>
    save.mutate(
      {
        id: treatment?.id,
        values: {
          service_id: v.service_id || null,
          description: v.description || null,
          treatment_date: v.treatment_date,
          total_amount: v.total_amount,
          discount: v.discount ?? 0,
          status: v.status,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{treatment ? "Edit treatment" : "Add treatment"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field label="Service">
            <select
              className={selectCls}
              {...register("service_id", {
                onChange: (e) => {
                  const s = services.data?.find((x) => x.id === e.target.value);
                  if (s && !treatment) setValue("total_amount", s.default_price);
                },
              })}
            >
              <option value="">Other / custom</option>
              {services.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {formatRs(s.default_price)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Details" error={errors.description?.message}>
            <Textarea rows={2} placeholder="e.g. tooth #26, session 1" {...register("description")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (Rs)" error={errors.total_amount?.message}>
              <Input className="h-11" inputMode="decimal" {...register("total_amount")} />
            </Field>
            <Field label="Discount (Rs)" error={errors.discount?.message}>
              <Input className="h-11" inputMode="decimal" {...register("discount")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" error={errors.treatment_date?.message}>
              <Input className="h-11" type="date" {...register("treatment_date")} />
            </Field>
            <Field label="Status">
              <select className={selectCls} {...register("status")}>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
          </div>
          <Button type="submit" className="h-11 w-full" disabled={save.isPending}>
            {save.isPending && <Spinner />} Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type PIn = z.input<typeof paymentSchema>;
type POut = z.output<typeof paymentSchema>;

export function PaymentDialog({
  open,
  onOpenChange,
  patientId,
  treatments,
  pendingOf,
  defaultTreatmentId,
  patientPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patientId: string;
  treatments: Treatment[];
  pendingOf: (treatmentId: string) => number;
  defaultTreatmentId?: string | undefined;
  patientPending: number;
}) {
  const add = useAddPayment(patientId);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<PIn, unknown, POut>({
    resolver: zodResolver(paymentSchema),
    values: {
      treatment_id: defaultTreatmentId ?? "",
      amount: "" as unknown as number,
      payment_date: todayISO(),
      method: "cash",
      note: "",
    },
  });
  const tid = watch("treatment_id");
  const max = tid ? pendingOf(tid) : patientPending;

  const onSubmit = (v: POut) => {
    if (v.amount > max) {
      setError("amount", { message: `Cannot exceed pending ${formatRs(max)}` });
      return;
    }
    add.mutate(
      {
        treatment_id: v.treatment_id || null,
        amount: v.amount,
        payment_date: v.payment_date,
        method: v.method,
        note: v.note || null,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  const open_ = treatments.filter((t) => pendingOf(t.id) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field label="Against treatment">
            <select className={selectCls} {...register("treatment_id")}>
              <option value="">General (whole balance)</option>
              {open_.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.services?.name ?? t.description ?? "Treatment"} — pending {formatRs(pendingOf(t.id))}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Amount (Rs) — max ${formatRs(max)}`} error={errors.amount?.message}>
            <Input className="h-11 text-lg" inputMode="decimal" autoFocus {...register("amount")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" error={errors.payment_date?.message}>
              <Input className="h-11" type="date" {...register("payment_date")} />
            </Field>
            <Field label="Method">
              <select className={selectCls} {...register("method")}>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="easypaisa">Easypaisa</option>
                <option value="jazzcash">JazzCash</option>
              </select>
            </Field>
          </div>
          <Field label="Note" error={errors.note?.message}>
            <Input className="h-11" {...register("note")} />
          </Field>
          <Button type="submit" className="h-11 w-full" disabled={add.isPending}>
            {add.isPending && <Spinner />} Record payment
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
