import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Copy, Check, QrCode, Globe } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/configs")({
  head: () => ({
    meta: [
      { title: "Tunnels — BLAC Tunnel Configs" },
      { name: "description", content: "Browse and copy free VLESS, VMESS, TROJAN and SSH tunnel configs. Live updates from BLAC Tunnel." },
      { property: "og:title", content: "BLAC Tunnel — Configs" },
      { property: "og:description", content: "Browse and copy free VPN configs. Live updated." },
    ],
  }),
  component: ConfigsPage,
});

type Config = {
  id: string;
  name: string;
  protocol: "VLESS" | "VMESS" | "TROJAN" | "SSH";
  server: string;
  port: number;
  config_string: string;
  country: string | null;
  notes: string | null;
  is_active: boolean;
};

const FILTERS = ["All", "VLESS", "VMESS", "TROJAN", "SSH"] as const;

const protoColor: Record<string, string> = {
  VLESS: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  VMESS: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  TROJAN: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  SSH: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

function ConfigsPage() {
  const [items, setItems] = useState<Config[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState<{ name: string; data: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase
      .from("configs")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) toast.error("Failed to load configs");
        else setItems((data ?? []) as Config[]);
        setLoading(false);
      });

    const channel = supabase
      .channel("configs-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "configs" }, (payload) => {
        setItems((prev) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Config;
            return row.is_active ? [row, ...prev] : prev;
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as Config;
            const exists = prev.some((c) => c.id === row.id);
            if (!row.is_active) return prev.filter((c) => c.id !== row.id);
            return exists ? prev.map((c) => (c.id === row.id ? row : c)) : [row, ...prev];
          }
          if (payload.eventType === "DELETE") {
            const row = payload.old as Config;
            return prev.filter((c) => c.id !== row.id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (filter !== "All" && c.protocol !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.server.toLowerCase().includes(q) ||
          (c.country ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, filter, search]);

  async function copyConfig(c: Config) {
    try {
      await navigator.clipboard.writeText(c.config_string);
      setCopied(c.id);
      toast.success(`Copied ${c.name}`);
      setTimeout(() => setCopied((v) => (v === c.id ? null : v)), 1500);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function showQR(c: Config) {
    const data = await QRCode.toDataURL(c.config_string, { width: 320, margin: 1, color: { dark: "#0a0f18", light: "#ffffff" } });
    setQr({ name: c.name, data });
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 anim-fade-up">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Available Tunnels</h1>
          <p className="text-sm text-muted-foreground mt-1">Live · updates instantly when admins add new configs.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="glass rounded-xl flex items-center px-3 py-2 w-full sm:w-72">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search configs..."
              className="bg-transparent border-none outline-none text-sm ml-2 w-full placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex glass rounded-xl p-1 gap-1 overflow-x-auto hide-scrollbar">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  filter === f
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-6 h-44 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-muted-foreground">No configs found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((c, i) => (
            <article
              key={c.id}
              className="glass rounded-2xl p-6 card-hover anim-fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${protoColor[c.protocol]}`}>
                      {c.protocol}
                    </span>
                    {c.country && (
                      <span className="text-[10px] uppercase text-muted-foreground inline-flex items-center gap-1">
                        <Globe className="w-3 h-3" /> {c.country}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-medium truncate">{c.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {c.server}:{c.port}
                    {c.notes ? ` · ${c.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => showQR(c)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                    aria-label="Show QR"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => copyConfig(c)}
                    className="px-3 py-2 rounded-lg bg-foreground text-background text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                  >
                    {copied === c.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === c.id ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-foreground/5 border border-foreground/5 p-3 font-mono text-[11px] text-muted-foreground break-all line-clamp-3">
                {c.config_string}
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={!!qr} onOpenChange={(o) => !o && setQr(null)}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle>{qr?.name}</DialogTitle>
          </DialogHeader>
          {qr && (
            <div className="flex flex-col items-center gap-3">
              <img src={qr.data} alt="Config QR" className="rounded-xl bg-white p-3" />
              <p className="text-xs text-muted-foreground text-center">Scan with your VPN client to import.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}