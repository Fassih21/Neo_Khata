import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loginSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/clinic/states";

type Search = { reason?: string | undefined };

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    reason: typeof s["reason"] === "string" ? s["reason"] : undefined,
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Login,
});

type Form = z.infer<typeof loginSchema>;

function Login() {
  const nav = useNavigate();
  const { reason } = Route.useSearch();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (v: Form) => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword(v);
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Wrong email or password" : error.message);
      return;
    }
    nav({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Stethoscope className="h-6 w-6" />
          </div>
          <CardTitle>NEO Dental Clinic</CardTitle>
          <p className="text-sm text-muted-foreground">Staff login</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {reason === "norole" && (
              <Alert variant="destructive">
                <AlertDescription>Your account has no access yet. Ask the owner to assign a role.</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" inputMode="email" className="h-11" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" className="h-11" {...register("password")} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
              {isSubmitting && <Spinner />} Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
