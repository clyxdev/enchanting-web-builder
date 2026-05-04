import { Link, useRouterState } from "@tanstack/react-router";
import { Moon, Sun, Shield, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useTheme } from "@/lib/theme";

const links = [
  { to: "/", label: "Home" },
  { to: "/configs", label: "Tunnels" },
  { to: "/admin/login", label: "Admin" },
];

export function SiteNav() {
  const { theme, toggle } = useTheme();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 glass border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 via-blue-500 to-violet-500 flex items-center justify-center text-white">
              <Shield className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <span className="font-semibold tracking-tight uppercase text-base">BLAC</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => {
              const active = l.to === "/" ? path === "/" : path.startsWith(l.to);
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`relative px-3 py-2 rounded-md text-sm font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 rounded-md bg-foreground/5"
                      transition={{ duration: 0.18 }}
                    />
                  )}
                  <span className="relative z-10">{l.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setOpen((o) => !o)}
              className="md:hidden p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              aria-label="Menu"
            >
              {open ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden pb-4 flex flex-col gap-1"
            >
              {links.map((l) => {
                const active = l.to === "/" ? path === "/" : path.startsWith(l.to);
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${active ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
