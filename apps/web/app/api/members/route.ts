// Staff member management API (privileged, service-role). Super-admin only.
// Lists / creates / deactivates dashboard members (everyone except field callers).
import { NextResponse } from "next/server";
import { adminConfigured, adminRest, adminRestAll, getRequester } from "@/lib/admin.server";

export const dynamic = "force-dynamic";

const STAFF_ROLES = ["super_admin", "regional_coordinator", "constituency_coordinator", "analyst"];

function scopeLabel(role: string, region?: string | null, con?: string | null) {
  if (role === "super_admin") return "National";
  if (role === "analyst") return region ? `${region} (read-only)` : "National (read-only)";
  if (con) return `${region ?? ""} · ${con}`;
  return region ?? "—";
}

async function requireSuper(req: Request) {
  if (!adminConfigured) return { error: NextResponse.json({ error: "Server is not configured." }, { status: 503 }) };
  const me = await getRequester(req);
  if (!me || me.role !== "super_admin") return { error: NextResponse.json({ error: "Super admin only." }, { status: 403 }) };
  return { me };
}

function serverError(e: unknown) {
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}

// Map a role + provided codes to region_id / constituency_id (resolving the ids).
async function resolveScope(role: string, regionCode?: string, constituencyCode?: string) {
  if (constituencyCode) {
    const cons = await adminRest<any[]>(`/rest/v1/constituencies?code=eq.${encodeURIComponent(constituencyCode)}&select=id,region_id`);
    if (!cons?.[0]) throw new Error("Unknown constituency.");
    return { regionId: cons[0].region_id as string, constituencyId: cons[0].id as string };
  }
  if (regionCode) {
    const regs = await adminRest<any[]>(`/rest/v1/regions?code=eq.${encodeURIComponent(regionCode)}&select=id`);
    if (!regs?.[0]) throw new Error("Unknown region.");
    return { regionId: regs[0].id as string, constituencyId: null };
  }
  void role;
  return { regionId: null, constituencyId: null };
}

// GET — list staff members with their scope.
export async function GET(req: Request) {
  const { error } = await requireSuper(req);
  if (error) return error;
  const rows = await adminRestAll<any>(
    "/rest/v1/profiles?role=in.(super_admin,regional_coordinator,constituency_coordinator,analyst)" +
      "&select=user_id,full_name,role,is_active,regions(name,code),constituencies(name,code)&order=role",
  );
  const members = (rows ?? []).map((r) => ({
    userId: r.user_id,
    fullName: r.full_name ?? "—",
    role: r.role,
    email: "",
    scope: scopeLabel(r.role, r.regions?.name, r.constituencies?.name),
    regionCode: r.regions?.code ?? null,
    conCode: r.constituencies?.code ?? null,
    isActive: r.is_active,
  }));
  return NextResponse.json({ members });
}

// PATCH — update a member's name, role and scope.
export async function PATCH(req: Request) {
  const { error } = await requireSuper(req);
  if (error) return error;
  try {
    const body = (await req.json().catch(() => null)) as
      | { userId?: string; fullName?: string; role?: string; regionCode?: string; constituencyCode?: string }
      | null;
    if (!body?.userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });
    if (body.role && !STAFF_ROLES.includes(body.role)) {
      return NextResponse.json({ error: "Invalid staff role." }, { status: 400 });
    }
    const scope = await resolveScope(body.role ?? "", body.regionCode, body.constituencyCode);
    const patch: Record<string, unknown> = { region_id: scope.regionId, constituency_id: scope.constituencyId };
    if (body.fullName) patch.full_name = body.fullName.trim();
    if (body.role) patch.role = body.role;
    await adminRest(`/rest/v1/profiles?user_id=eq.${body.userId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

// POST — create a staff login and assign scope.
export async function POST(req: Request) {
  const { me, error } = await requireSuper(req);
  if (error) return error;
  void me;
  try {
  const body = (await req.json().catch(() => null)) as
    | { fullName?: string; email?: string; password?: string; role?: string; regionCode?: string; constituencyCode?: string }
    | null;
  if (!body?.fullName?.trim() || !body?.email?.trim() || !body?.password || !body?.role) {
    return NextResponse.json({ error: "fullName, email, password and role are required." }, { status: 400 });
  }
  if (!STAFF_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Invalid staff role." }, { status: 400 });
  }

  let regionId: string | null = null;
  let constituencyId: string | null = null;
  if (body.constituencyCode) {
    const cons = await adminRest<any[]>(`/rest/v1/constituencies?code=eq.${encodeURIComponent(body.constituencyCode)}&select=id,region_id`);
    if (!cons?.[0]) return NextResponse.json({ error: "Unknown constituency." }, { status: 400 });
    constituencyId = cons[0].id;
    regionId = cons[0].region_id;
  } else if (body.regionCode) {
    const regs = await adminRest<any[]>(`/rest/v1/regions?code=eq.${encodeURIComponent(body.regionCode)}&select=id`);
    if (!regs?.[0]) return NextResponse.json({ error: "Unknown region." }, { status: 400 });
    regionId = regs[0].id;
  }

  let userId: string;
  try {
    const user = await adminRest<{ id: string }>("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email: body.email.trim(), password: body.password, email_confirm: true }),
    });
    userId = user.id;
  } catch (e) {
    if (!/already|registered|exists/i.test(String(e))) throw e;
    const list = await adminRest<{ users?: any[] }>("/auth/v1/admin/users?per_page=1000");
    const found = (list.users ?? []).find((u: any) => u.email === body.email!.trim());
    if (!found) return NextResponse.json({ error: "Email in use but unresolved." }, { status: 409 });
    userId = found.id;
    await adminRest(`/auth/v1/admin/users/${userId}`, { method: "PUT", body: JSON.stringify({ password: body.password }) });
  }

  await adminRest("/rest/v1/profiles?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      full_name: body.fullName.trim(),
      role: body.role,
      region_id: regionId,
      constituency_id: constituencyId,
      is_active: true,
    }),
  });
  return NextResponse.json({ ok: true, userId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// DELETE — deactivate a staff member.
export async function DELETE(req: Request) {
  const { error } = await requireSuper(req);
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  await adminRest(`/rest/v1/profiles?user_id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ is_active: false }),
  });
  return NextResponse.json({ ok: true });
}
