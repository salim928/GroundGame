// Caller management API (privileged, service-role). All actions verify the
// requester's JWT + scope first. Super admins manage any constituency; regional
// coordinators only their region; constituency coordinators only their own.
import { NextResponse } from "next/server";
import { adminConfigured, adminRest, adminRestAll, canManageConstituency, getRequester } from "@/lib/admin.server";

export const dynamic = "force-dynamic";

const MANAGER_ROLES = ["super_admin", "regional_coordinator", "constituency_coordinator"];

function configError() {
  return NextResponse.json({ error: "Server is not configured for admin actions." }, { status: 503 });
}

// Surface the underlying Supabase/GoTrue error (this is an internal admin tool).
function serverError(e: unknown) {
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}

// GET /api/callers — list callers visible to the requester.
export async function GET(req: Request) {
  if (!adminConfigured) return configError();
  const me = await getRequester(req);
  if (!me || !MANAGER_ROLES.includes(me.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const rows = await adminRestAll<any>(
    "/rest/v1/profiles?role=eq.caller&select=user_id,full_name,is_active,constituency_id," +
      "constituencies(name,code,region_id,regions(name,code))&order=full_name",
  );
  const callers = (rows ?? [])
    .filter((r) =>
      canManageConstituency(me, r.constituencies?.region_id ?? null, r.constituency_id ?? null),
    )
    .map((r) => ({
      userId: r.user_id,
      fullName: r.full_name,
      isActive: r.is_active,
      constituency: r.constituencies?.name ?? null,
      region: r.constituencies?.regions?.name ?? null,
    }));
  return NextResponse.json({ callers });
}

// POST /api/callers — create a caller login and assign a constituency.
export async function POST(req: Request) {
  if (!adminConfigured) return configError();
  try {
    const me = await getRequester(req);
    if (!me || !MANAGER_ROLES.includes(me.role)) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    const body = (await req.json().catch(() => null)) as
      | { fullName?: string; email?: string; password?: string; constituencyCode?: string }
      | null;
    if (!body?.fullName?.trim() || !body?.email?.trim() || !body?.password || !body?.constituencyCode) {
      return NextResponse.json({ error: "fullName, email, password and constituencyCode are required." }, { status: 400 });
    }

    // Resolve the constituency and check the requester may manage it.
    const cons = await adminRest<any[]>(
      `/rest/v1/constituencies?code=eq.${encodeURIComponent(body.constituencyCode)}&select=id,region_id,name`,
    );
    const con = cons?.[0];
    if (!con) return NextResponse.json({ error: "Unknown constituency." }, { status: 400 });
    if (!canManageConstituency(me, con.region_id, con.id)) {
      return NextResponse.json({ error: "You can't assign callers to that constituency." }, { status: 403 });
    }

    // Create the auth user (or reuse if the email already exists).
    let userId: string;
    try {
      const user = await adminRest<{ id: string }>("/auth/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({ email: body.email.trim(), password: body.password, email_confirm: true }),
      });
      userId = user.id;
    } catch (e) {
      if (!/already|registered|exists/i.test(String(e))) throw e;
      // Email already exists — find and reuse that account.
      const list = await adminRest<{ users?: any[] }>("/auth/v1/admin/users?per_page=1000");
      const found = (list.users ?? []).find((u: any) => u.email === body.email!.trim());
      if (!found) return NextResponse.json({ error: "Email is in use but could not be resolved." }, { status: 409 });
      userId = found.id;
      await adminRest(`/auth/v1/admin/users/${userId}`, { method: "PUT", body: JSON.stringify({ password: body.password }) });
    }

    await adminRest("/rest/v1/profiles?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        user_id: userId,
        full_name: body.fullName.trim(),
        role: "caller",
        region_id: con.region_id,
        constituency_id: con.id,
        is_active: true,
      }),
    });

    return NextResponse.json({ ok: true, userId, constituency: con.name });
  } catch (e) {
    return serverError(e);
  }
}

// DELETE /api/callers?id=<userId> — deactivate a caller (soft).
export async function DELETE(req: Request) {
  if (!adminConfigured) return configError();
  const me = await getRequester(req);
  if (!me || !MANAGER_ROLES.includes(me.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const rows = await adminRest<any[]>(
    `/rest/v1/profiles?user_id=eq.${id}&select=constituency_id,constituencies(region_id)`,
  );
  const p = rows?.[0];
  if (!p) return NextResponse.json({ error: "Caller not found." }, { status: 404 });
  if (!canManageConstituency(me, p.constituencies?.region_id ?? null, p.constituency_id ?? null)) {
    return NextResponse.json({ error: "Not in your scope." }, { status: 403 });
  }
  await adminRest(`/rest/v1/profiles?user_id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ is_active: false }),
  });
  return NextResponse.json({ ok: true });
}
