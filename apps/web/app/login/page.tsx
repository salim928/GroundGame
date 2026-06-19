import { BrandPanel } from "@/components/BrandPanel";
import { LoginForm } from "@/components/LoginForm";

// Split landing: NDC "Operations Excellence" brand panel | demo login form.
export default function LoginPage() {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <BrandPanel />
      <LoginForm />
    </div>
  );
}
