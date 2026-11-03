import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BadgeDollarSign, LayoutDashboard, LogOut, MoreHorizontal, Receipt, Settings, Stethoscope, Users, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/auth";
import { useClinicSettings } from "@/lib/hooks";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Item = { to: "/dashboard" | "/patients" | "/pending" | "/expenses" | "/employees" | "/settings"; label: string; icon: typeof Users };

const dashboard: Item = { to: "/dashboard", label: "Home", icon: LayoutDashboard };
const patients: Item = { to: "/patients", label: "Patients", icon: Users };
const pending: Item = { to: "/pending", label: "Pending", icon: BadgeDollarSign };
const expenses: Item = { to: "/expenses", label: "Expenses", icon: Receipt };
const employees: Item = { to: "/employees", label: "Staff", icon: UserCog };
const settings: Item = { to: "/settings", label: "Settings", icon: Settings };

export function AppShell({ role, email, children }: { role: Role; email: string; children: ReactNode }) {
  const nav = useNavigate();
  const [more, setMore] = useState(false);
  const { data: clinic } = useClinicSettings();

  const all = role === "owner" ? [dashboard, patients, pending, expenses, employees, settings] : [dashboard, patients, pending, expenses, settings];
  // bottom bar: 4 main tabs + "More" (owner) or Settings (manager)
  const bottom = role === "owner" ? [dashboard, patients, pending, expenses] : [dashboard, patients, pending, expenses, settings];
  const overflow = role === "owner" ? [employees, settings] : [];

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === "SIGNED_OUT") nav({ to: "/login" });
    });
    return () => data.subscription.unsubscribe();
  }, [nav]);

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/login" });
  };

  const linkCls = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent";
  const activeCls = { className: "bg-accent text-foreground" };

  return (
    <div className="min-h-dvh bg-muted/30 md:flex">
      {/* desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-background p-4 md:sticky md:top-0 md:flex md:h-dvh">
        <div className="mb-6 flex items-center gap-2 px-2">
          <Stethoscope className="h-5 w-5" />
          <span className="truncate font-semibold">{clinic?.clinic_name ?? "NEO Dental Clinic"}</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {all.map((i) => (
            <Link key={i.to} to={i.to} className={linkCls} activeProps={activeCls}>
              <i.icon className="h-4 w-4" /> {i.label === "Home" ? "Dashboard" : i.label}
            </Link>
          ))}
        </nav>
        <div className="border-t pt-3">
          <p className="truncate px-2 text-xs text-muted-foreground">{email}</p>
          <p className="px-2 pb-2 text-xs capitalize text-muted-foreground">{role}</p>
          <button onClick={signOut} className={cn(linkCls, "w-full")}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] md:px-8 md:pb-8">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>

      {/* mobile bottom tabs */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Main"
      >
        <ul className="flex">
          {bottom.map((i) => (
            <li key={i.to} className="flex-1">
              <Link
                to={i.to}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
                activeProps={{ className: "text-primary" }}
              >
                <i.icon className="h-5 w-5" />
                {i.label}
              </Link>
            </li>
          ))}
          {role === "owner" && (
            <li className="flex-1">
              <button
                onClick={() => setMore(true)}
                className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
              >
                <MoreHorizontal className="h-5 w-5" />
                More
              </button>
            </li>
          )}
        </ul>
      </nav>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="mt-2 flex flex-col">
            {overflow.map((i) => (
              <Link key={i.to} to={i.to} onClick={() => setMore(false)} className={cn(linkCls, "min-h-12 text-base")}>
                <i.icon className="h-5 w-5" /> {i.label === "Staff" ? "Employees & Salaries" : i.label}
              </Link>
            ))}
            <button onClick={signOut} className={cn(linkCls, "min-h-12 text-base")}>
              <LogOut className="h-5 w-5" /> Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
