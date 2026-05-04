import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Server,
  ShieldCheck,
  Activity,
  Loader2,
  Power,
  Clock3,
  History,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  adminLogout,
  deleteAdminConfig,
  getAdminDashboard,
  saveAdminConfig,
} from "@/server/admin.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Dashboard · BLAC Tunnel" }, { name: "robots", content: "noindex" }],
  }),
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
type AuditLog = {
  id: string;
  config_id: string | null;
  config_name: string;
  protocol: Protocol | null;
  action: "created" | "updated" | "deleted" | string;
  actor_name: string;
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
  const loadDashboardFn = useServerFn(getAdminDashboard);
  const saveConfigFn = useServerFn(saveAdminConfig);
  const deleteConfigFn = useServerFn(deleteAdminConfig);
  const logoutFn = useServerFn(adminLogout);
  const [token, setToken] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [items, setItems] = useState<Config[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Config | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadDashboard = useCallback(
    async (activeToken: string, quiet = false) => {
      try {
        const data = await loadDashboardFn({ data: { token: activeToken } });
        setItems(data.configs as Config[]);
        setLogs(data.logs as AuditLog[]);
        setAuthed(true);
      } catch {
        localStorage.removeItem("blac-admin-token");
        setAuthed(false);
        if (!quiet) toast.error("Please login again");
        navigate({ to: "/admin/login" });
      } finally {
        setLoading(false);
      }
    },
    [loadDashboardFn, navigate],
  );

  useEffect(() => {
    const stored = localStorage.getItem("blac-admin-token");
    if (!stored) {
      setAuthed(false);
      navigate({ to: "/admin/login" });
      return;
    }
    setToken(stored);
    loadDashboard(stored, true);
  }, [loadDashboard, navigate]);

  useEffect(() => {
    if (!token || !authed) return;
    const refresh = () => loadDashboard(token, true);
    const channel = supabase
      .channel("configs-admin-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "configs" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authed, loadDashboard, token]);

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
    if (!token) return;
    const parsed = configSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSaving(true);
    try {
      await saveConfigFn({ data: { token, id: editing?.id, config: parsed.data } });
      toast.success(editing ? "Updated" : "Created");
      setOpen(false);
      await loadDashboard(token, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: Config) {
    if (!token || !confirm(`Delete "${c.name}"?`)) return;
    try {
      await deleteConfigFn({ data: { token, id: c.id } });
      toast.success("Deleted");
      await loadDashboard(token, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  async function toggleActive(c: Config) {
    if (!token) return;
    try {
      await saveConfigFn({
        data: {
          token,
          id: c.id,
          config: {
            name: c.name,
            protocol: c.protocol,
            server: c.server,
            port: c.port,
            config_string: c.config_string,
            country: c.country ?? "",
            notes: c.notes ?? "",
            is_active: !c.is_active,
          },
        },
      });
      await loadDashboard(token, true);
    } catch {
      toast.error("Status update failed");
    }
  }

  async function logout() {
    if (token) await logoutFn({ data: { token } }).catch(() => null);
    localStorage.removeItem("blac-admin-token");
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
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage configs, track edits, and update the public site instantly.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={openNew}
            className="px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium inline-flex items-center justify-center gap-2 hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> New Config
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 rounded-full glass text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-foreground/5"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
      >
        <Stat
          icon={Server}
          label="Total Configs"
          value={stats.total}
          accent="text-cyan-600 bg-cyan-500/10"
        />
        <Stat
          icon={Activity}
          label="Active"
          value={stats.active}
          accent="text-emerald-600 bg-emerald-500/10"
        />
        <Stat
          icon={ShieldCheck}
          label="Protocols"
          value={stats.protocols}
          accent="text-violet-600 bg-violet-500/10"
        />
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
        <motion.div layout className="glass rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-foreground/5">
            <div className="col-span-4">Name</div>
            <div className="col-span-2">Protocol</div>
            <div className="col-span-3">Server</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {loading ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              No configs yet — click “New Config”.
            </div>
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              {items.map((c) => (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 px-4 sm:px-5 py-4 items-start md:items-center text-sm border-b border-foreground/5 last:border-b-0 hover:bg-foreground/[0.02]"
                >
                  <div className="md:col-span-4 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.notes || "—"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border border-foreground/10 bg-foreground/5">
                      {c.protocol}
                    </span>
                  </div>
                  <div className="md:col-span-3 truncate text-muted-foreground text-xs">
                    {c.server}:{c.port}
                  </div>
                  <div className="md:col-span-1">
                    <button
                      onClick={() => toggleActive(c)}
                      className={`text-[10px] font-medium px-2 py-1 rounded-md inline-flex items-center gap-1 ${
                        c.is_active
                          ? "text-emerald-600 bg-emerald-500/10"
                          : "text-muted-foreground bg-foreground/5"
                      }`}
                      title="Toggle active"
                    >
                      <Power className="w-3 h-3" /> {c.is_active ? "On" : "Off"}
                    </button>
                  </div>
                  <div className="md:col-span-2 flex md:justify-end gap-1">
                    <button
                      onClick={() => openEdit(c)}
                      className="p-2 rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-foreground"
                      aria-label="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(c)}
                      className="p-2 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </motion.div>

        <AuditPanel logs={logs} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass max-w-xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Config" : "New Config"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name" full>
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Protocol">
              <select
                className={inputCls}
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value as Protocol })}
              >
                {(["VLESS", "VMESS", "TROJAN", "SSH"] as Protocol[]).map((p) => (
                  <option key={p} value={p} className="bg-background">
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Country">
              <input
                className={inputCls}
                value={form.country ?? ""}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </Field>
            <Field label="Server">
              <input
                className={inputCls}
                value={form.server}
                onChange={(e) => setForm({ ...form, server: e.target.value })}
              />
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
              <input
                className={inputCls}
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
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
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg text-sm hover:bg-foreground/5"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
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

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      {label && (
        <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
      className="glass rounded-2xl p-5 flex items-center gap-4"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <h3 className="text-2xl font-semibold tracking-tight">{value}</h3>
      </div>
    </motion.div>
  );
}

function AuditPanel({ logs }: { logs: AuditLog[] }) {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 h-fit"
    >
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-tight">Activity audit</h2>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No admin actions recorded yet.</p>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="rounded-xl border border-foreground/5 bg-foreground/[0.025] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium capitalize">
                      {log.action} · {log.config_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      by {log.actor_name}
                      {log.protocol ? ` · ${log.protocol}` : ""}
                    </p>
                  </div>
                  <Clock3 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {new Date(log.created_at).toLocaleString()}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.aside>
  );
}
