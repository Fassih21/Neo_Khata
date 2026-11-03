import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { monthStart, nextMonthStart, num } from "./format";

export type Patient = Tables<"patients">;
export type Treatment = Tables<"treatments"> & { services: { name: string } | null };
export type Payment = Tables<"payments">;
export type Service = Tables<"services">;
export type Expense = Tables<"expenses">;
export type Employee = Tables<"employees">;
export type Salary = Tables<"salaries"> & { employees: { full_name: string; role_title: string } | null };
export type ClinicSettings = Tables<"clinic_settings">;

export function errMsg(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong";
}

const keys = {
  patients: ["patients"] as const,
  patient: (id: string) => ["patient", id] as const,
  pending: ["pending"] as const,
};

function useInvalidate() {
  const qc = useQueryClient();
  return (...k: (readonly unknown[])[]) => k.forEach((key) => qc.invalidateQueries({ queryKey: key }));
}

/* ---------- settings & services ---------- */
export function useClinicSettings() {
  return useQuery({
    queryKey: ["clinic_settings"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("clinic_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as ClinicSettings | null;
    },
  });
}

export function useServices() {
  return useQuery({
    queryKey: ["services"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Service[];
    },
  });
}

/* ---------- patients ---------- */
export type PatientRow = Patient & { total_billed: number; total_paid: number; pending_amount: number };

export function usePatients(search: string) {
  return useQuery({
    queryKey: [...keys.patients, search],
    queryFn: async () => {
      let q = supabase.from("patients").select("*").order("created_at", { ascending: false }).limit(300);
      const s = search.trim().replace(/[%,()]/g, "");
      if (s) q = q.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%`);
      const [p, b] = await Promise.all([q, supabase.from("patient_balances").select("*")]);
      if (p.error) throw p.error;
      if (b.error) throw b.error;
      const map = new Map(b.data.map((x) => [x.patient_id, x]));
      return p.data.map((pt) => {
        const bal = map.get(pt.id);
        return {
          ...pt,
          total_billed: num(bal?.total_billed),
          total_paid: num(bal?.total_paid),
          pending_amount: num(bal?.pending_amount),
        } as PatientRow;
      });
    },
  });
}

export function usePatientDetail(id: string) {
  return useQuery({
    queryKey: keys.patient(id),
    queryFn: async () => {
      const [p, t, y, b, tb] = await Promise.all([
        supabase.from("patients").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("treatments")
          .select("*, services(name)")
          .eq("patient_id", id)
          .order("treatment_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select("*")
          .eq("patient_id", id)
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("patient_balances").select("*").eq("patient_id", id).maybeSingle(),
        supabase.from("treatment_balances").select("*").eq("patient_id", id),
      ]);
      for (const r of [p, t, y, b, tb]) if (r.error) throw r.error;
      const tbMap = new Map((tb.data ?? []).map((x) => [x.treatment_id, x]));
      return {
        patient: p.data as Patient | null,
        treatments: (t.data ?? []) as Treatment[],
        payments: (y.data ?? []) as Payment[],
        balance: {
          billed: num(b.data?.total_billed),
          paid: num(b.data?.total_paid),
          pending: num(b.data?.pending_amount),
        },
        treatmentBalance: (tid: string) => ({
          net: num(tbMap.get(tid)?.net_amount),
          paid: num(tbMap.get(tid)?.paid_amount),
          pending: num(tbMap.get(tid)?.pending_amount),
        }),
      };
    },
  });
}

export function useSavePatient() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id?: string | undefined; values: TablesInsert<"patients"> }) => {
      if (v.id) {
        const { error } = await supabase.from("patients").update(v.values as TablesUpdate<"patients">).eq("id", v.id);
        if (error) throw error;
        return v.id;
      }
      const { data, error } = await supabase.from("patients").insert(v.values).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      inv(keys.patients, keys.patient(id), keys.pending);
      toast.success("Patient saved");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useDeletePatient() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      inv(keys.patients, keys.pending, ["dashboard"]);
      toast.success("Patient deleted");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

/* ---------- treatments & payments ---------- */
export function useSaveTreatment(patientId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id?: string | undefined; values: Omit<TablesInsert<"treatments">, "patient_id"> }) => {
      if (v.id) {
        const { error } = await supabase.from("treatments").update(v.values).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("treatments").insert({ ...v.values, patient_id: patientId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      inv(keys.patient(patientId), keys.patients, keys.pending, ["dashboard"]);
      toast.success("Treatment saved");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useDeleteTreatment(patientId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("treatments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      inv(keys.patient(patientId), keys.patients, keys.pending, ["dashboard"]);
      toast.success("Treatment deleted");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useAddPayment(patientId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (values: Omit<TablesInsert<"payments">, "patient_id">) => {
      const { error } = await supabase.from("payments").insert({ ...values, patient_id: patientId });
      if (error) throw error;
    },
    onSuccess: () => {
      inv(keys.patient(patientId), keys.patients, keys.pending, ["dashboard"]);
      toast.success("Payment recorded");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useDeletePayment(patientId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      inv(keys.patient(patientId), keys.patients, keys.pending, ["dashboard"]);
      toast.success("Payment deleted");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

/* ---------- pending & reminders ---------- */
export type PendingRow = {
  patient_id: string;
  full_name: string;
  phone: string;
  total_billed: number;
  total_paid: number;
  pending_amount: number;
  last_reminder_at: string | null;
  reminder_count: number;
  last_treatment_date: string | null;
};

export function usePendingList() {
  return useQuery({
    queryKey: keys.pending,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_list")
        .select("*")
        .order("pending_amount", { ascending: false });
      if (error) throw error;
      return data.map((r) => ({
        patient_id: r.patient_id!,
        full_name: r.full_name ?? "",
        phone: r.phone ?? "",
        total_billed: num(r.total_billed),
        total_paid: num(r.total_paid),
        pending_amount: num(r.pending_amount),
        last_reminder_at: r.last_reminder_at,
        reminder_count: r.reminder_count ?? 0,
        last_treatment_date: r.last_treatment_date,
      })) as PendingRow[];
    },
  });
}

export function useLogReminder() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (v: { patient_id: string; pending_amount: number; message: string }) => {
      const { error } = await supabase.from("reminder_log").insert(v);
      if (error) throw error;
    },
    onSuccess: () => {
      inv(keys.pending);
      toast.success("Reminder logged");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

/* ---------- expenses ---------- */
export function useExpenses(month: string) {
  return useQuery({
    queryKey: ["expenses", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("expense_date", monthStart(month))
        .lt("expense_date", nextMonthStart(month))
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });
}

export function useSaveExpense() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id?: string | undefined; values: TablesInsert<"expenses"> }) => {
      const q = v.id
        ? supabase.from("expenses").update(v.values).eq("id", v.id)
        : supabase.from("expenses").insert(v.values);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      inv(["expenses"], ["dashboard"]);
      toast.success("Expense saved");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useDeleteExpense() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      inv(["expenses"], ["dashboard"]);
      toast.success("Expense deleted");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

/* ---------- employees & salaries ---------- */
export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("is_active", { ascending: false }).order("full_name");
      if (error) throw error;
      return data as Employee[];
    },
  });
}

export function useSaveEmployee() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id?: string | undefined; values: TablesInsert<"employees"> }) => {
      const q = v.id
        ? supabase.from("employees").update(v.values).eq("id", v.id)
        : supabase.from("employees").insert(v.values);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      inv(["employees"], ["salaries"]);
      toast.success("Employee saved");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useSalaries(month: string) {
  return useQuery({
    queryKey: ["salaries", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salaries")
        .select("*, employees(full_name, role_title)")
        .gte("month", monthStart(month))
        .lt("month", nextMonthStart(month))
        .order("status", { ascending: true });
      if (error) throw error;
      return data as Salary[];
    },
  });
}

export function useGenerateSalaries() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (v: { month: string; employees: Employee[] }) => {
      const rows = v.employees
        .filter((e) => e.is_active)
        .map((e) => ({ employee_id: e.id, month: monthStart(v.month), amount: e.monthly_salary, status: "pending" as const }));
      if (rows.length === 0) throw new Error("No active employees");
      // ignoreDuplicates keeps already-paid rows untouched
      const { error } = await supabase.from("salaries").upsert(rows, { onConflict: "employee_id,month", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => {
      inv(["salaries"], ["dashboard"]);
      toast.success("Salary records ready");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

export function useUpdateSalary() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id: string; values: TablesUpdate<"salaries"> }) => {
      const { error } = await supabase.from("salaries").update(v.values).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      inv(["salaries"], ["dashboard"]);
      toast.success("Salary updated");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
}

/* ---------- dashboard ---------- */
export type OwnerDash = {
  revenue: number;
  expenses_other: number;
  salaries_paid: number;
  expenses_total: number;
  net: number;
  active_patients: number;
  pending_amount: number;
  salaries_pending: number;
  total_billed: number;
  total_paid: number;
  trend: { month: string; revenue: number; expenses: number }[];
};
export type ManagerDash = {
  active_patients: number;
  new_patients: number;
  treatments: number;
  pending_amount: number;
  patients_with_pending: number;
};

export function useDashboard<T>(role: "owner" | "manager", month: string) {
  return useQuery({
    queryKey: ["dashboard", role, month],
    queryFn: async () => {
      const fn = role === "owner" ? "dashboard_owner" : "dashboard_manager";
      const { data, error } = await supabase.rpc(fn, { _month: monthStart(month) });
      if (error) throw error;
      return data as unknown as T;
    },
  });
}
