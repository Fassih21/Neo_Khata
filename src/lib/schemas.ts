import { z } from "zod";
import { normalizePkPhone } from "./format";

const money = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .max(100000000, `${label} is too large`);

export const phoneField = z
  .string()
  .trim()
  .min(1, "Phone is required")
  .refine((v) => normalizePkPhone(v) !== null, "Enter a valid Pakistani mobile (03xx xxxxxxx)");

export const patientSchema = z.object({
  full_name: z.string().trim().min(2, "Name is required").max(100),
  phone: phoneField,
  address: z.string().trim().max(250).optional().or(z.literal("")),
  age: z
    .union([z.literal(""), z.coerce.number().int("Whole number").min(0).max(120)])
    .optional(),
  gender: z.enum(["male", "female", "other"]).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type PatientInput = z.infer<typeof patientSchema>;

export const treatmentSchema = z
  .object({
    service_id: z.string().optional().or(z.literal("")),
    description: z.string().trim().max(500).optional().or(z.literal("")),
    treatment_date: z.string().min(1, "Date is required"),
    total_amount: money("Amount"),
    discount: money("Discount").optional().default(0),
    status: z.enum(["ongoing", "completed"]),
  })
  .refine((v) => (v.discount ?? 0) <= v.total_amount, {
    message: "Discount cannot exceed amount",
    path: ["discount"],
  });
export type TreatmentInput = z.infer<typeof treatmentSchema>;

export const paymentSchema = z.object({
  treatment_id: z.string().optional().or(z.literal("")),
  amount: money("Amount").refine((v) => v > 0, "Amount must be more than 0"),
  payment_date: z.string().min(1, "Date is required"),
  method: z.enum(["cash", "bank", "easypaisa", "jazzcash"]),
  note: z.string().trim().max(250).optional().or(z.literal("")),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const EXPENSE_CATEGORIES = [
  "rent",
  "utilities",
  "dental supplies",
  "lab",
  "equipment",
  "maintenance",
  "other",
] as const;

export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: money("Amount").refine((v) => v > 0, "Amount must be more than 0"),
  expense_date: z.string().min(1, "Date is required"),
  description: z.string().trim().max(250).optional().or(z.literal("")),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

export const employeeSchema = z.object({
  full_name: z.string().trim().min(2, "Name is required").max(100),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  role_title: z.string().trim().min(2, "Role is required").max(60),
  monthly_salary: money("Salary"),
  joining_date: z.string().min(1, "Date is required"),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const clinicSchema = z.object({
  clinic_name: z.string().trim().min(2, "Required").max(100),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(250).optional().or(z.literal("")),
  whatsapp_reminder_template: z
    .string()
    .trim()
    .min(10, "Template is too short")
    .max(800)
    .refine((v) => v.includes("{pending_amount}"), "Must include {pending_amount}"),
});
export type ClinicInput = z.infer<typeof clinicSchema>;

export const passwordSchema = z
  .object({
    password: z.string().min(8, "At least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const newUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters").max(72),
  full_name: z.string().trim().min(2, "Name is required").max(100),
  role: z.enum(["owner", "manager"]),
});
