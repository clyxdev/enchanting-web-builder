# BLAC Tunnel — Premium Config Site

A modern, glass-styled VPN config sharing website inspired by your HTML, rebuilt as a polished React app with a real backend so the admin can add/edit/delete configs in real time and all visitors see updates instantly.

## Design Direction (most important — public UI must look premium)

- **Aesthetic**: Apple-like minimal, dark-first with light mode toggle.
- **Glass effect everywhere** — frosted backdrop-blur cards, navbar, modals.
- **Smooth motion** — fade/slide page transitions, hover lift on cards, animated copy feedback, subtle stagger on list load.
- **No glow / no neon shadows** — clean borders, soft contrast, gradient accents only on text and small badges. Strict: no `box-shadow` glow, no `text-shadow` glow.
- **Typography**: Inter (UI) + JetBrains Mono (config strings).
- **Palette**: slate dark base (#0a0f18 / #151e2e), white surfaces in light mode, gradient accent (cyan → blue → purple) used sparingly on text + status dots only.
- **Micro-interactions**: copy-to-clipboard with checkmark swap, toast notifications, skeleton loaders, ping dot for "live".

## Pages (separate routes, each with its own SEO meta)

1. **Home `/`**
   - Hero: "Welcome to BLAC Tunnel 2025" with gradient text, status pill ("System Online"), two CTAs (Get Configs / Join Community).
   - 4 trust badges (Free, Fast, Secure, Updated Daily) — glass cards.
   - Developers & Friends grid (4 team cards, editable later).

2. **Tunnels `/configs`**
   - Search bar + filter pills (All / VLESS / VMESS / TROJAN / SSH).
   - Responsive grid of config cards: protocol badge, name, server location, ping, mono-formatted config string (truncated), Copy button, QR icon (opens modal with QR).
   - Live updates — when admin adds a config, it appears here without refresh (Supabase realtime).

3. **Admin Login `/admin/login`**
   - Glass card form, username + password.
   - Credentials: **username `shnwazdev`, password `dev`** (seeded into Lovable Cloud auth as an admin user, role stored in `user_roles` table — never on profile).

4. **Admin Dashboard `/admin`** (protected, role-gated)
   - Stats cards: total configs, by protocol, last updated.
   - Configs table with inline actions: **Add new**, **Edit**, **Delete**, toggle Active.
   - Add/Edit modal: name, protocol (VLESS/VMESS/TROJAN/SSH), server, port, config string (textarea), country flag, notes.
   - Site settings panel: edit Telegram link, hero tagline, team members.
   - Logout.

## Data Model (Lovable Cloud)

- `configs` — id, name, protocol, server, port, config_string, country, notes, is_active, created_at, updated_at.
- `team_members` — id, name, role, initial, accent_color, sort_order.
- `site_settings` — key/value (telegram_url, hero_tagline, etc.).
- `user_roles` — user_id, role enum (`admin`, `user`) — separate table, RLS via `has_role()` security-definer function.

**RLS policies**:
- Public (anon): SELECT on `configs WHERE is_active`, `team_members`, `site_settings`.
- Admins only: full INSERT/UPDATE/DELETE on all tables.

**Realtime** enabled on `configs` so the public Tunnels page updates live.

## Tech Notes (technical section)

- Framework: existing TanStack Start setup, Tailwind v4, shadcn components (Button, Dialog, Input, Table, Badge, Tooltip, Sonner toasts).
- Auth: Lovable Cloud email/password. Seed `shnwazdev@blac.local` / `dev` and insert `admin` row into `user_roles` via migration.
- Route guard: `_authenticated/_admin` layout that calls `has_role(uid, 'admin')` via server fn; redirect non-admins to `/admin/login`.
- Realtime subscription on Tunnels page using browser supabase client.
- Form validation with Zod (length limits, protocol enum).
- Copy-to-clipboard via `navigator.clipboard` with toast.
- QR generation client-side with `qrcode` package.

## Out of scope (can add later)
- Config usage analytics, user accounts for visitors, multiple admins UI, file uploads, payment tiers.
