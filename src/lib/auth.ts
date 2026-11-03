import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type Role = "owner" | "manager";

export async function loadAuth(): Promise<{ userId: string; email: string; role: Role }> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw redirect({ to: "/login" });

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id);
  if (error || !roles || roles.length === 0) {
    await supabase.auth.signOut();
    throw redirect({ to: "/login", search: { reason: "norole" } });
  }
  const role: Role = roles.some((r) => r.role === "owner") ? "owner" : "manager";
  return { userId: session.user.id, email: session.user.email ?? "", role };
}
