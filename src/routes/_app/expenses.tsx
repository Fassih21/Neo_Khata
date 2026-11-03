import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MonthSelect } from "@/components/clinic/month-select";
import { EmptyState, ErrorState, LoadingList, PageHeader, Spinner } from "@/components/clinic/states";
import { Field } from "@/components/clinic/patient-form";
import { EXPENSE_CATEGORIES, expenseSchema } from "@/lib/schemas";
import { fmtDate, formatRs, monthKey, todayISO } from "@/lib/format";
import { useDeleteExpense, useExpenses, useSaveExpense, type Expense } from "@/lib/hooks";

export const Route = createFileRoute("/_app/expenses")({ component: Expenses });

type In = z.input<typeof expenseSchema>;
type Out = z.output<typeof expenseSchema>;

function Expenses() {
  const { role } = Route.useRouteContext();
  const owner = role === "owner";
  const [month, setMonth] = useState(monthKey());
  const [cat, setCat] = useState<string>("all");
  const q = useExpenses(month);
  const del = useDeleteExpense();
  const [edit, setEdit] = useState<Expense | null>(null);
  const [open, setOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);

  const rows = (q.data ?? []).filter((e) => cat === "all" || e.category === cat);
  const total = rows.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <>
      <PageHeader
        title="Expenses"
        action={
          <Button className="h-11" onClick={() => { setEdit(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3">
        <MonthSelect value={month} onChange={setMonth} />
        <select className="h-11 rounded-md border border-input bg-background px-3 text-sm capitalize" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      {!owner && <p className="mb-3 text-xs text-muted-foreground">You can add expenses and see the ones you added.</p>}
      {q.isLoading ? (
        <LoadingList />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="No expenses" hint="Nothing recorded for this filter" />
      ) : (
        <>
          {owner && <p className="mb-3 text-sm text-muted-foreground">Total: <span className="font-semibold text-foreground">{formatRs(total)}</span></p>}
          <ul className="space-y-3">
            {rows.map((e) => (
              <li key={e.id}>
                <Card>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{formatRs(e.amount)}</p>
                        <Badge variant="secondary" className="capitalize">{e.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{fmtDate(e.expense_date)}{e.description ? ` · ${e.description}` : ""}</p>
                    </div>
                    {owner && (
                      <>
                        <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => { setEdit(e); setOpen(true); }} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => setDelId(e.id)} aria-label="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
      <ExpenseDialog open={open} onOpenChange={setOpen} expense={edit} />
      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this expense?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-11" onClick={() => delId && del.mutate(delId, { onSettled: () => setDelId(null) })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ExpenseDialog({ open, onOpenChange, expense }: { open: boolean; onOpenChange: (o: boolean) => void; expense: Expense | null }) {
  const save = useSaveExpense();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<In, unknown, Out>({
    resolver: zodResolver(expenseSchema),
    values: {
      category: (expense?.category as Out["category"]) ?? "other",
      amount: expense ? expense.amount : ("" as unknown as number),
      expense_date: expense?.expense_date ?? todayISO(),
      description: expense?.description ?? "",
    },
  });
  const onSubmit = (v: Out) =>
    save.mutate(
      { id: expense?.id, values: { category: v.category, amount: v.amount, expense_date: v.expense_date, description: v.description || null } },
      { onSuccess: () => { reset(); onOpenChange(false); } },
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field label="Category">
            <select className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm capitalize" {...register("category")}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (Rs)" error={errors.amount?.message}><Input className="h-11" inputMode="decimal" {...register("amount")} /></Field>
            <Field label="Date" error={errors.expense_date?.message}><Input className="h-11" type="date" {...register("expense_date")} /></Field>
          </div>
          <Field label="Description" error={errors.description?.message}><Input className="h-11" {...register("description")} /></Field>
          <Button type="submit" className="h-11 w-full" disabled={save.isPending}>{save.isPending && <Spinner />} Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
