import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { patientSchema } from "@/lib/schemas";
import { useSavePatient, type Patient } from "@/lib/hooks";
import { Spinner } from "./states";

type In = z.input<typeof patientSchema>;
type Out = z.output<typeof patientSchema>;

export function PatientDialog({
  open,
  onOpenChange,
  patient,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patient?: Patient | null;
  onSaved?: (id: string) => void;
}) {
  const save = useSavePatient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<In, unknown, Out>({
    resolver: zodResolver(patientSchema),
    values: {
      full_name: patient?.full_name ?? "",
      phone: patient?.phone ?? "",
      address: patient?.address ?? "",
      age: patient?.age ?? "",
      gender: (patient?.gender as "male" | "female" | "other" | null) ?? "",
      notes: patient?.notes ?? "",
    },
  });

  const onSubmit = (v: Out) => {
    save.mutate(
      {
        id: patient?.id,
        values: {
          full_name: v.full_name,
          phone: v.phone,
          address: v.address || null,
          age: v.age === "" || v.age === undefined ? null : Number(v.age),
          gender: v.gender || null,
          notes: v.notes || null,
        },
      },
      {
        onSuccess: (id) => {
          reset();
          onOpenChange(false);
          onSaved?.(id);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{patient ? "Edit patient" : "New patient"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field label="Full name" error={errors.full_name?.message}>
            <Input className="h-11" {...register("full_name")} />
          </Field>
          <Field label="Phone (WhatsApp)" error={errors.phone?.message}>
            <Input className="h-11" inputMode="tel" placeholder="03xx xxxxxxx" {...register("phone")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age" error={errors.age?.message}>
              <Input className="h-11" inputMode="numeric" {...register("age")} />
            </Field>
            <Field label="Gender">
              <select className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" {...register("gender")}>
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
          <Field label="Address" error={errors.address?.message}>
            <Input className="h-11" {...register("address")} />
          </Field>
          <Field label="Notes" error={errors.notes?.message}>
            <Textarea rows={3} {...register("notes")} />
          </Field>
          <Button type="submit" className="h-11 w-full" disabled={save.isPending}>
            {save.isPending && <Spinner />} Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
