import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { Lock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { adminLogin } from "@/server/admin.functions";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin · BLAC Tunnel" }, { name: "robots", content: "noindex" }] }),
  component: AdminLogin,
});

function AdminLogin() {
  const [username, setUsername] = useState("dev");
  const [password, setPassword] = useState("dev");
  const [loading, setLoading] = useState(false);
  const login = useServerFn(adminLogin);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login({ data: { username, password } });
      localStorage.setItem("blac-admin-token", result.token);
      toast.success(`Welcome ${result.admin.display_name}`);
      navigate({ to: "/admin" });
    } catch {
      toast.error("Invalid admin username or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-14 sm:py-20">
      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
        className="glass rounded-3xl p-6 sm:p-8"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto rounded-xl bg-foreground text-background flex items-center justify-center mb-4">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Admin Access</h1>
          <p className="text-xs text-muted-foreground mt-1">Restricted area · dev panel.</p>
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
      </motion.form>
    </div>
  );
}
