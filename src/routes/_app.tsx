import { createFileRoute, Outlet } from "@tanstack/react-router";
import { loadAuth } from "@/lib/auth";
import { AppShell } from "@/components/clinic/app-shell";

// Session lives in browser storage, so the guard runs client-side only.
export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async () => loadAuth(),
  component: Layout,
});

function Layout() {
  const { role, email } = Route.useRouteContext();
  return (
    <AppShell role={role} email={email}>
      <Outlet />
    </AppShell>
  );
}
