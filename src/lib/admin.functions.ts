import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { newUserSchema } from "./schemas";

// Owner-only: create a staff login and assign its role. Needs SUPABASE_SERVICE_ROLE_KEY on the server.
export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => newUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isOwner, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (roleErr || !isOwner) throw new Error("Only the owner can create users");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");

    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    if (rErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(rErr.message);
    }
    return { ok: true as const };
  });
