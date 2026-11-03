import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function Spinner() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : "Failed to load";
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <p className="text-sm">{msg}</p>
      {retry && (
        <Button size="sm" variant="outline" onClick={retry} className="min-h-11">
          Try again
        </Button>
      )}
    </div>
  );
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {action}
    </div>
  );
}
