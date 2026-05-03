import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin · BLAC Tunnel" }, { name: "robots", content: "noindex" }] }),
  component: AdminLogin,
});

function usernameToEmail(u: string) {
  return `${u.trim().toLowerCase()}@blac.local`;
}

function AdminLogin() {
  const [username, setUsername] = useState("shnwazdev");
  const [password, setPassword] = useState("dev");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error || !data.user) {
      setLoading(false);
      toast.error("Invalid credentials");
      return;
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      await supabase.auth.signOut();
      setLoading(false);
      toast.error("Not an admin account");
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/admin" });
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-20 anim-fade-up">
      <form onSubmit={onSubmit} className="glass rounded-3xl p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto rounded-xl bg-foreground text-background flex items-center justify-center mb-4">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Admin Access</h1>
          <p className="text-xs text-muted-foreground mt-1">Restricted area · use your admin credentials.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full glass rounded-xl px-4 py-3 text-sm outline-none focus:border-foreground/30 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full glass rounded-xl px-4 py-3 text-sm outline-none focus:border-foreground/30 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-foreground text-background rounded-xl py-3 text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Authenticate
          </button>
        </div>
      </form>
    </div>
  );
}