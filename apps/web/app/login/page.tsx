import { BrandPanel } from "@/components/BrandPanel";
import { RoleChooser } from "@/components/RoleChooser";

// Split landing: NDC "Operations Excellence" brand panel | role chooser.
// Each role opens its own login portal at /login/<slug>.
export default function LoginPage() {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <BrandPanel />
      <RoleChooser />
    </div>
  );
}
