import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/clinic/patient-form";
import { ErrorState, LoadingList, PageHeader, Spinner } from "@/components/clinic/states";
import { clinicSchema, newUserSchema, passwordSchema } from "@/lib/schemas";
import { errMsg, useClinicSettings } from "@/lib/hooks";
import { createStaffUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/_app/settings")({ component: Settings });

function Settings() {
  const { role, email } = Route.useRouteContext();
  const owner = role === "owner";
  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{email} · <span className="capitalize">{role}</span></p>
        <PasswordCard />
        <ClinicCard owner={owner} />
        {owner && <UsersCard />}
      </div>
    </>
  );
}

function PasswordCard() {
  type F = z.infer<typeof passwordSchema>;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<F>({ resolver: zodResolver(passwordSchema) });
  const onSubmit = async (v: F) => {
    const { error } = await supabase.auth.updateUser({ password: v.password });
    if (error) return void toast.error(error.message);
    toast.success("Password changed");
    reset();
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Change password</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <Field label="New password" error={errors.password?.message}><Input className="h-11" type="password" autoComplete="new-password" {...register("password")} /></Field>
          <Field label="Confirm password" error={errors.confirm?.message}><Input className="h-11" type="password" autoComplete="new-password" {...register("confirm")} /></Field>
          <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>{isSubmitting && <Spinner />} Update password</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ClinicCard({ owner }: { owner: boolean }) {
  const q = useClinicSettings();
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof clinicSchema>>({
    resolver: zodResolver(clinicSchema),
    values: {
      clinic_name: q.data?.clinic_name ?? "",
      phone: q.data?.phone ?? "",
      address: q.data?.address ?? "",
      whatsapp_reminder_template: q.data?.whatsapp_reminder_template ?? "",
    },
  });
  const save = useMutation({
    mutationFn: async (v: z.infer<typeof clinicSchema>) => {
      if (!q.data) throw new Error("Settings row missing");
      const { error } = await supabase.from("clinic_settings").update({ ...v, phone: v.phone || null, address: v.address || null }).eq("id", q.data.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clinic_settings"] }); toast.success("Saved"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (q.isLoading) return <LoadingList rows={1} />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Clinic & reminder</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-3" noValidate>
          <fieldset disabled={!owner} className="space-y-3">
            <Field label="Clinic name" error={errors.clinic_name?.message}><Input className="h-11" {...register("clinic_name")} /></Field>
            <Field label="Phone" error={errors.phone?.message}><Input className="h-11" inputMode="tel" {...register("phone")} /></Field>
            <Field label="Address" error={errors.address?.message}><Input className="h-11" {...register("address")} /></Field>
            <Field label="WhatsApp reminder template" error={errors.whatsapp_reminder_template?.message}>
              <Textarea rows={5} {...register("whatsapp_reminder_template")} />
            </Field>
            <p className="text-xs text-muted-foreground">Use {"{patient_name}"}, {"{clinic_name}"}, {"{pending_amount}"}.</p>
          </fieldset>
          {owner ? (
            <Button type="submit" className="h-11 w-full" disabled={save.isPending}>{save.isPending && <Spinner />} Save</Button>
          ) : (
            <p className="text-xs text-muted-foreground">Only the owner can edit these.</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function UsersCard() {
  const qc = useQueryClient();
  const create = useServerFn(createStaffUser);
  const users = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const [r, p] = await Promise.all([supabase.from("user_roles").select("user_id, role"), supabase.from("profiles").select("id, full_name")]);
      if (r.error) throw r.error;
      if (p.error) throw p.error;
      const names = new Map(p.data.map((x) => [x.id, x.full_name]));
      return r.data.map((x) => ({ ...x, name: names.get(x.user_id) ?? "—" }));
    },
  });
  type F = z.infer<typeof newUserSchema>;
  const { register, handleSubmit, reset, formState: { errors } } = useForm<F>({ resolver: zodResolver(newUserSchema), defaultValues: { role: "manager" } });
  const add = useMutation({
    mutationFn: (v: F) => create({ data: v }),
    onSuccess: () => { toast.success("User created"); reset({ role: "manager" } as F); qc.invalidateQueries({ queryKey: ["staff"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Users</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {users.isLoading ? <LoadingList rows={2} /> : users.error ? <ErrorState error={users.error} retry={() => users.refetch()} /> : (
          <ul className="space-y-2">
            {users.data!.map((u) => (
              <li key={u.user_id} className="flex items-center justify-between rounded-lg border p-3">
                <span className="truncate text-sm">{u.name}</span>
                <Badge variant={u.role === "owner" ? "default" : "secondary"} className="capitalize">{u.role}</Badge>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleSubmit((v) => add.mutate(v))} className="space-y-3 border-t pt-4" noValidate>
          <p className="text-sm font-medium">Add staff login</p>
          <Field label="Name" error={errors.full_name?.message}><Input className="h-11" {...register("full_name")} /></Field>
          <Field label="Email" error={errors.email?.message}><Input className="h-11" type="email" {...register("email")} /></Field>
          <Field label="Temporary password" error={errors.password?.message}><Input className="h-11" type="password" autoComplete="new-password" {...register("password")} /></Field>
          <Field label="Role">
            <select className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" {...register("role")}>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
          </Field>
          <Button type="submit" className="h-11 w-full" disabled={add.isPending}>{add.isPending && <Spinner />} Create user</Button>
        </form>
      </CardContent>
    </Card>
  );
}
