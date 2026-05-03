import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DollarSign, Zap, ShieldCheck, History, Send, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BLAC Tunnel — Free Premium VPN Configs" },
      { name: "description", content: "Welcome to BLAC Tunnel — fastest free VLESS, VMESS, TROJAN and SSH configs, updated daily." },
      { property: "og:title", content: "BLAC Tunnel — Free Premium VPN Configs" },
      { property: "og:description", content: "Fastest free VLESS, VMESS, TROJAN and SSH configs, updated daily." },
    ],
  }),
  component: HomePage,
});

type Team = { id: string; name: string; role: string; initial: string; accent: string };

const accentMap: Record<string, string> = {
  cyan: "text-cyan-400 bg-cyan-500/10",
  purple: "text-violet-400 bg-violet-500/10",
  blue: "text-blue-400 bg-blue-500/10",
  rose: "text-rose-400 bg-rose-500/10",
};

function HomePage() {
  const [team, setTeam] = useState<Team[]>([]);
  const [tagline, setTagline] = useState(
    "Fastest Free VLESS, VMESS, TROJAN & SSH Configs. Bypass restrictions with military-grade encryption.",
  );

  useEffect(() => {
    supabase.from("team_members").select("*").order("sort_order").then(({ data }) => {
      if (data) setTeam(data as Team[]);
    });
    supabase.from("site_settings").select("*").eq("key", "hero_tagline").maybeSingle().then(({ data }) => {
      if (data?.value) setTagline(data.value);
    });
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      {/* Hero */}
      <section className="text-center max-w-4xl mx-auto anim-fade-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs font-medium mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
          </span>
          <span className="text-muted-foreground">System Online · V2.0 Active</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] mb-6">
          Welcome to <span className="grad-text">BLAC Tunnel</span>
          <br />
          <span className="text-muted-foreground font-light text-3xl md:text-5xl">2026</span>
        </h1>

        <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
          {tagline}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/configs"
            className="px-7 py-3 rounded-full bg-foreground text-background font-medium text-sm hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2"
          >
            Get Free Configs <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="https://t.me/yourchannel"
            target="_blank"
            rel="noreferrer"
            className="px-7 py-3 rounded-full glass font-medium text-sm hover:bg-foreground/5 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" /> Join Community
          </a>
        </div>
      </section>

      {/* Trust badges */}
      <section className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
        {[
          { icon: DollarSign, label: "100% Free", sub: "No hidden costs", color: "text-cyan-400 bg-cyan-500/10" },
          { icon: Zap, label: "Lightning Fast", sub: "Low latency nodes", color: "text-violet-400 bg-violet-500/10" },
          { icon: ShieldCheck, label: "Secure", sub: "AES-256 encryption", color: "text-emerald-400 bg-emerald-500/10" },
          { icon: History, label: "Updated Daily", sub: "Fresh configs", color: "text-rose-400 bg-rose-500/10" },
        ].map((b, i) => (
          <div
            key={b.label}
            className="glass rounded-2xl p-6 flex flex-col items-center text-center gap-3 card-hover"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${b.color}`}>
              <b.icon className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <h3 className="text-sm font-medium tracking-tight">{b.label}</h3>
            <p className="text-xs text-muted-foreground">{b.sub}</p>
          </div>
        ))}
      </section>

      {/* Team */}
      <section className="mt-32 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">Developers &amp; Friends</h2>
          <p className="text-sm text-muted-foreground">The minds behind the infrastructure.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {team.map((m) => (
            <div key={m.id} className="glass rounded-2xl p-6 flex flex-col items-center text-center card-hover">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-medium mb-4 ${accentMap[m.accent] ?? accentMap.cyan}`}>
                {m.initial}
              </div>
              <h4 className="text-sm font-medium">{m.name}</h4>
              <span className="text-xs text-muted-foreground mt-1">{m.role}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
