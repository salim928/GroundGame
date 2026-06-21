// Delegate editing API (privileged, service-role). Verifies the requester's JWT
// and that the delegate's constituency is within their scope before any write.
import { NextResponse } from "next/server";
import { adminConfigured, adminRest, canManageConstituency, getRequester } from "@/lib/admin.server";

export const dynamic = "force-dynamic";

const EDITOR_ROLES = ["super_admin", "regional_coordinator", "constituency_coordinator"];

function guard(me: Awaited<ReturnType<typeof getRequester>>) {
  if (!adminConfigured) return NextResponse.json({ error: "Server is not configured for admin actions." }, { status: 503 });
  if (!me || !EDITOR_ROLES.includes(me.role)) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  return null;
}

// Resolve a delegate's constituency + region so we can scope-check the editor.
async function delegateScope(id: string) {
  const rows = await adminRest<any[]>(
    `/rest/v1/delegates?id=eq.${id}&select=constituency_id,constituencies(region_id)`,
  );
  const d = rows?.[0];
  return d ? { constituencyId: d.constituency_id as string, regionId: d.constituencies?.region_id ?? null } : null;
}

// POST — add a delegate to a constituency.
export async function POST(req: Request) {
  const me = await getRequester(req);
  const blocked = guard(me);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => null)) as
    | { constituencyCode?: string; position?: string; name?: string; contact?: string | null }
    | null;
  if (!body?.constituencyCode || !body?.name?.trim()) {
    return NextResponse.json({ error: "constituencyCode and name are required." }, { status: 400 });
  }
  const cons = await adminRest<any[]>(
    `/rest/v1/constituencies?code=eq.${encodeURIComponent(body.constituencyCode)}&select=id,region_id,code`,
  );
  const con = cons?.[0];
  if (!con) return NextResponse.json({ error: "Unknown constituency." }, { status: 400 });
  if (!canManageConstituency(me!, con.region_id, con.id)) {
    return NextResponse.json({ error: "Out of your scope." }, { status: 403 });
  }
  const externalRef = `${con.code}-APP-${Date.now().toString(36)}`;
  const created = await adminRest<any[]>("/rest/v1/delegates", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      constituency_id: con.id,
      external_ref: externalRef,
      full_name: body.name.trim(),
      phone: body.contact?.trim() || null,
      position: body.position?.trim() || null,
      is_active: true,
    }),
  });
  return NextResponse.json({ ok: true, id: created?.[0]?.id });
}

// PATCH — edit a delegate's name / phone / position.
export async function PATCH(req: Request) {
  const me = await getRequester(req);
  const blocked = guard(me);
  if (blocked) return blocked;
  const body = (await req.json().catch(() => null)) as
    | { id?: string; position?: string; name?: string; contact?: string | null }
    | null;
  if (!body?.id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  const scope = await delegateScope(body.id);
  if (!scope) return NextResponse.json({ error: "Delegate not found." }, { status: 404 });
  if (!canManageConstituency(me!, scope.regionId, scope.constituencyId)) {
    return NextResponse.json({ error: "Out of your scope." }, { status: 403 });
  }
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.full_name = body.name.trim();
  if (body.contact !== undefined) patch.phone = body.contact?.trim() || null;
  if (body.position !== undefined) patch.position = body.position?.trim() || null;
  await adminRest(`/rest/v1/delegates?id=eq.${body.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  return NextResponse.json({ ok: true });
}

// DELETE — soft-delete a delegate (preserves any linked call analytics).
export async function DELETE(req: Request) {
  const me = await getRequester(req);
  const blocked = guard(me);
  if (blocked) return blocked;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  const scope = await delegateScope(id);
  if (!scope) return NextResponse.json({ error: "Delegate not found." }, { status: 404 });
  if (!canManageConstituency(me!, scope.regionId, scope.constituencyId)) {
    return NextResponse.json({ error: "Out of your scope." }, { status: 403 });
  }
  await adminRest(`/rest/v1/delegates?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ is_active: false }),
  });
  return NextResponse.json({ ok: true });
}
