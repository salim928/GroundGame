import Link from "next/link";
import { Target } from "lucide-react";

// Branded 404 so an unknown URL never drops to Next's default screen.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-4 flex items-center gap-2 text-foreground">
        <Target size={22} className="text-primary" />
        <span className="text-lg font-semibold">GroundGame</span>
      </div>
      <p className="text-5xl font-semibold tracking-tight text-foreground">404</p>
      <h1 className="mt-3 text-lg font-medium text-foreground">Page not found</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
