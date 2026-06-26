"use client";

import { useState } from "react";
import { Check, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Lets any signed-in user change their own password via Supabase Auth
// (updateUser uses their own JWT — no admin/service role involved).
export function ChangePassword() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) return setMsg({ ok: false, text: "Use at least 8 characters." });
    if (pw !== confirm) return setMsg({ ok: false, text: "The two passwords don't match." });
    const supa = getSupabase();
    if (!supa) return setMsg({ ok: false, text: "Sign-in isn't configured in this environment." });
    setBusy(true);
    const { error } = await supa.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setMsg({ ok: true, text: "Password updated. Use it next time you sign in." });
    setPw("");
    setConfirm("");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="np">New password</Label>
        <Input id="np" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cp">Confirm new password</Label>
        <Input id="cp" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter the password" />
      </div>

      {msg && (
        <div className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {msg.ok ? <Check size={15} className="mt-0.5 shrink-0" /> : <TriangleAlert size={15} className="mt-0.5 shrink-0" />}
          {msg.text}
        </div>
      )}

      <Button type="submit" disabled={busy}>
        {busy ? <><Loader2 className="animate-spin" /> Updating…</> : <><KeyRound /> Update password</>}
      </Button>
    </form>
  );
}
