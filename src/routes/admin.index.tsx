import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LogOut, Plus, Pencil, Trash2, Server, ShieldCheck, Activity, Loader2, Power } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Dashboard · BLAC Tunnel" }, { name: "robots", content: "noindex" }] }),
  component: AdminDash,
});

type Protocol = "VLESS" | "VMESS" | "TROJAN" | "SSH";
type Config = {
  id: string;
  name: string;
  protocol: Protocol;
  server: string;
  port: number;
  config_string: string;
  country: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

const configSchema = z.object({
  name: z.string().trim().min(1).max(120),
  protocol: z.enum(["VLESS", "VMESS", "TROJAN", "SSH"]),
  server: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  config_string: z.string().trim().min(1).max(4000),
  country: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(255).optional().or(z.literal("")),
  is_active: z.boolean(),
});

const empty: Omit<Config, "id" | "created_at"> = {
  name: "",
  protocol: "VLESS",
  server: "",
  port: 443,
  config_string: "",
  country: "",
  notes: "",
  is_active: true,
};

function AdminDash() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [items, setItems] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Config | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // gate
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/admin/login" });
        return;
      }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      const isAdmin = roles?.some((r) => r.role === "admin");
      if (!mounted) return;
      if (!isAdmin) {
        await supabase.auth.signOut();
        navigate({ to: "/admin/login" });
        return;
      }
      setAuthed(true);
    })();
    return () => { mounted = false; };
  }, [navigate]);

  // load + realtime
  useEffect(() => {
    if (!authed) return;
    supabase
      .from("configs")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Load failed");
        else setItems((data ?? []) as Config[]);
        setLoading(false);
      });
    const channel = supabase
      .channel("configs-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "configs" }, (payload) => {
        setItems((prev) => {
          if (payload.eventType === "INSERT") return [payload.new as Config, ...prev];
          if (payload.eventType === "UPDATE")
            return prev.map((c) => (c.id === (payload.new as Config).id ? (payload.new as Config) : c));
          if (payload.eventType === "DELETE")
            return prev.filter((c) => c.id !== (payload.old as Config).id);
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authed]);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.is_active).length;
    const protocols = new Set(items.map((i) => i.protocol)).size;
    return { total, active, protocols };
  }, [items]);

  function openNew() {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  }

  function openEdit(c: Config) {
    setEditing(c);
    setForm({
      name: c.name,
      protocol: c.protocol,
      server: c.server,
      port: c.port,
      config_string: c.config_string,
      country: c.country ?? "",
      notes: c.notes ?? "",
      is_active: c.is_active,
    });
    setOpen(true);
  }

  async function save() {
    const parsed = configSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from("configs").update(parsed.data).eq("id", editing.id);
      if (error) toast.error(error.message);
      else toast.success("Updated");
    } else {
      const { error } = await supabase.from("configs").insert(parsed.data);
      if (error) toast.error(error.message);
      else toast.success("Created");
    }
    setSaving(false);
    setOpen(false);
  }

  async function remove(c: Config) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    const { error } = await supabase.from("configs").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else toast.success("Deleted");
  }

  async function toggleActive(c: Config) {
    const { error } = await supabase.from("configs").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) toast.error(error.message);
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (authed === null) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 anim-fade-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage configs in real time. Public site updates instantly.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openNew}
            className="px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium inline-flex items-center gap-2 hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> New Config
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 rounded-full glass text-sm font-medium inline-flex items-center gap-2 hover:bg-foreground/5"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Stat icon={Server} label="Total Configs" value={stats.total} accent="text-cyan-400 bg-cyan-500/10" />
        <Stat icon={Activity} label="Active" value={stats.active} accent="text-emerald-400 bg-emerald-500/10" />
        <Stat icon={ShieldCheck} label="Protocols" value={stats.protocols} accent="text-violet-400 bg-violet-500/10" />
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-foreground/5">
          <div className="col-span-4">Name</div>
          <div className="col-span-2">Protocol</div>
          <div className="col-span-3">Server</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {loading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">No configs yet — click “New Config”.</div>
        ) : (
          items.map((c) => (
            <div key={c.id} className="grid grid-cols-12 gap-3 px-5 py-4 items-center text-sm border-b border-foreground/5 last:border-b-0 hover:bg-foreground/[0.02]">
              <div className="col-span-4 min-w-0">
                <p className="font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">{c.notes || "—"}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border border-foreground/10 bg-foreground/5">{c.protocol}</span>
              </div>
              <div className="col-span-3 truncate text-muted-foreground text-xs">{c.server}:{c.port}</div>
              <div className="col-span-1">
                <button
                  onClick={() => toggleActive(c)}
                  className={`text-[10px] font-medium px-2 py-1 rounded-md inline-flex items-center gap-1 ${
                    c.is_active ? "text-emerald-400 bg-emerald-500/10" : "text-muted-foreground bg-foreground/5"
                  }`}
                  title="Toggle active"
                >
                  <Power className="w-3 h-3" /> {c.is_active ? "On" : "Off"}
                </button>
              </div>
              <div className="col-span-2 flex justify-end gap-1">
                <button onClick={() => openEdit(c)} className="p-2 rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-foreground" aria-label="Edit">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(c)} className="p-2 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400" aria-label="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Config" : "New Config"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" full>
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Protocol">
              <select
                className={inputCls}
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value as Protocol })}
              >
                {(["VLESS", "VMESS", "TROJAN", "SSH"] as Protocol[]).map((p) => (
                  <option key={p} value={p} className="bg-background">{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Country (e.g. US)">
              <input className={inputCls} value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </Field>
            <Field label="Server">
              <input className={inputCls} value={form.server} onChange={(e) => setForm({ ...form, server: e.target.value })} />
            </Field>
            <Field label="Port">
              <input
                type="number"
                className={inputCls}
                value={form.port}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value || "0", 10) })}
              />
            </Field>
            <Field label="Notes" full>
              <input className={inputCls} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <Field label="Config String" full>
              <textarea
                rows={4}
                className={`${inputCls} font-mono text-xs`}
                value={form.config_string}
                onChange={(e) => setForm({ ...form, config_string: e.target.value })}
              />
            </Field>
            <Field label="" full>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Visible to public
              </label>
            </Field>
          </div>
          <DialogFooter>
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm hover:bg-foreground/5">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Save" : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const inputCls =
  "w-full glass rounded-xl px-3 py-2 text-sm outline-none focus:border-foreground/30 transition-colors bg-background/40";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : "col-span-1"}>
      {label && <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">{label}</label>}
      {children}
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; accent: string }) {
  return (
    <div className="glass rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <h3 className="text-2xl font-semibold tracking-tight">{value}</h3>
      </div>
    </div>
  );
}