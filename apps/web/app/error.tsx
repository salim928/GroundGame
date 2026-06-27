"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

// Root error boundary — covers routes outside the dashboard group (login, caller).
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <TriangleAlert size={22} />
      </div>
      <h1 className="mt-4 text-lg font-semibold text-foreground">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        This is usually temporary — try again in a moment.
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        <RefreshCw size={16} /> Try again
      </button>
    </div>
  );
}
