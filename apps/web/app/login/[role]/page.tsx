import { notFound } from "next/navigation";
import { BrandPanel } from "@/components/BrandPanel";
import { LoginForm } from "@/components/LoginForm";
import { SLUG_ROLE } from "@/lib/access";

// Per-role login portal. Auth is the same Supabase sign-in, but the form is
// branded for the role and rejects accounts whose real role doesn't match.
export default async function RoleLoginPage({ params }: { params: Promise<{ role: string }> }) {
  const { role: slug } = await params;
  const role = SLUG_ROLE[slug];
  if (!role) notFound();
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <BrandPanel />
      <LoginForm expectedRole={role} />
    </div>
  );
}
