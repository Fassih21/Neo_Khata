import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CheckCircle2, Pencil, Plus, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MonthSelect } from "@/components/clinic/month-select";
import { EmptyState, ErrorState, LoadingList, PageHeader, Spinner } from "@/components/clinic/states";
import { Field } from "@/components/clinic/patient-form";
import { employeeSchema } from "@/lib/schemas";
import { fmtDate, formatRs, monthKey, todayISO } from "@/lib/format";
import { useEmployees, useGenerateSalaries, useSalaries, useSaveEmployee, useUpdateSalary, type Employee } from "@/lib/hooks";

export const Route = createFileRoute("/_app/employees")({
  beforeLoad: ({ context }) => {
    if (context.role !== "owner") throw redirect({ to: "/dashboard" });
  },
  component: Employees,
});

function Employees() {
  return (
    <>
      <PageHeader title="Employees & Salaries" />
      <Tabs defaultValue="salaries">
        <TabsList className="mb-4 grid h-11 w-full grid-cols-2">
          <TabsTrigger value="salaries" className="h-9">Salaries</TabsTrigger>
          <TabsTrigger value="people" className="h-9">Employees</TabsTrigger>
        </TabsList>
        <TabsContent value="salaries"><SalariesTab /></TabsContent>
        <TabsContent value="people"><PeopleTab /></TabsContent>
      </Tabs>
    </>
  );
}

function SalariesTab() {
  const [month, setMonth] = useState(monthKey());
  const q = useSalaries(month);
  const emps = useEmployees();
  const gen = useGenerateSalaries();
  const upd = useUpdateSalary();
  const rows = q.data ?? [];
  const pending = rows.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.amount), 0);
  const paid = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-3">
      <MonthSelect value={month} onChange={setMonth} />
      <Button variant="outline" className="h-11 w-full" disabled={gen.isPending || !emps.data} onClick={() => gen.mutate({ month, employees: emps.data! })}>
        {gen.isPending && <Spinner />} Generate records for active employees
      </Button>
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 text-center">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Paid</p><p className="font-semibold text-emerald-600">{formatRs(paid)}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Pending</p><p className="font-semibold text-amber-600">{formatRs(pending)}</p></CardContent></Card>
        </div>
      )}
      {q.isLoading ? (
        <LoadingList rows={3} />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No salary records" hint="Tap Generate to create this month's records" />
      ) : (
        rows.map((s) => (
          <Card key={s.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.employees?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{s.employees?.role_title}</p>
                </div>
                <Badge variant={s.status === "paid" ? "secondary" : "destructive"} className="capitalize">{s.status}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold tabular-nums">{formatRs(s.amount)}</p>
                {s.status === "paid" ? (
                  <Button size="sm" variant="ghost" className="h-10" disabled={upd.isPending} onClick={() => upd.mutate({ id: s.id, values: { status: "pending", paid_date: null } })}>
                    <Undo2 className="h-4 w-4" /> Undo ({fmtDate(s.paid_date)})
                  </Button>
                ) : (
                  <Button size="sm" className="h-10" disabled={upd.isPending} onClick={() => upd.mutate({ id: s.id, values: { status: "paid", paid_date: todayISO() } })}>
                    <CheckCircle2 className="h-4 w-4" /> Mark paid
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

type In = z.input<typeof employeeSchema>;
type Out = z.output<typeof employeeSchema>;

function PeopleTab() {
  const q = useEmployees();
  const save = useSaveEmployee();
  const [edit, setEdit] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <Button className="h-11 w-full" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" /> Add employee</Button>
      {q.isLoading ? <LoadingList rows={3} /> : q.error ? <ErrorState error={q.error} retry={() => q.refetch()} /> : q.data!.length === 0 ? <EmptyState title="No employees yet" /> : q.data!.map((e) => (
        <Card key={e.id} className={e.is_active ? "" : "opacity-60"}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{e.full_name}</p>
              <p className="text-xs text-muted-foreground">{e.role_title} · {formatRs(e.monthly_salary)}/month</p>
            </div>
            <Button size="sm" variant="outline" className="h-10" onClick={() => save.mutate({ id: e.id, values: { full_name: e.full_name, role_title: e.role_title, is_active: !e.is_active } })}>
              {e.is_active ? "Deactivate" : "Activate"}
            </Button>
            <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => { setEdit(e); setOpen(true); }} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
          </CardContent>
        </Card>
      ))}
      <EmployeeDialog open={open} onOpenChange={setOpen} employee={edit} />
    </div>
  );
}

function EmployeeDialog({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (o: boolean) => void; employee: Employee | null }) {
  const save = useSaveEmployee();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<In, unknown, Out>({
    resolver: zodResolver(employeeSchema),
    values: {
      full_name: employee?.full_name ?? "",
      phone: employee?.phone ?? "",
      role_title: employee?.role_title ?? "",
      monthly_salary: employee ? employee.monthly_salary : ("" as unknown as number),
      joining_date: employee?.joining_date ?? todayISO(),
    },
  });
  const onSubmit = (v: Out) =>
    save.mutate(
      { id: employee?.id, values: { full_name: v.full_name, phone: v.phone || null, role_title: v.role_title, monthly_salary: v.monthly_salary, joining_date: v.joining_date } },
      { onSuccess: () => { reset(); onOpenChange(false); } },
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{employee ? "Edit employee" : "Add employee"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field label="Full name" error={errors.full_name?.message}><Input className="h-11" {...register("full_name")} /></Field>
          <Field label="Role (e.g. Receptionist)" error={errors.role_title?.message}><Input className="h-11" {...register("role_title")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly salary (Rs)" error={errors.monthly_salary?.message}><Input className="h-11" inputMode="decimal" {...register("monthly_salary")} /></Field>
            <Field label="Joining date" error={errors.joining_date?.message}><Input className="h-11" type="date" {...register("joining_date")} /></Field>
          </div>
          <Field label="Phone" error={errors.phone?.message}><Input className="h-11" inputMode="tel" {...register("phone")} /></Field>
          <Button type="submit" className="h-11 w-full" disabled={save.isPending}>{save.isPending && <Spinner />} Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
