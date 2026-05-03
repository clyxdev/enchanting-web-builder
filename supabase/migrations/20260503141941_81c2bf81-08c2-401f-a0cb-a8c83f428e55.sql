
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Protocol enum
CREATE TYPE public.config_protocol AS ENUM ('VLESS', 'VMESS', 'TROJAN', 'SSH');

-- Configs
CREATE TABLE public.configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  protocol config_protocol NOT NULL,
  server text NOT NULL,
  port integer NOT NULL DEFAULT 443,
  config_string text NOT NULL,
  country text DEFAULT '',
  notes text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active configs"
  ON public.configs FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert configs"
  ON public.configs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update configs"
  ON public.configs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete configs"
  ON public.configs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Team members
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  initial text NOT NULL,
  accent text NOT NULL DEFAULT 'cyan',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view team members"
  ON public.team_members FOR SELECT USING (true);
CREATE POLICY "Admins manage team"
  ON public.team_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Site settings
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings"
  ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage settings"
  ON public.site_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER configs_updated BEFORE UPDATE ON public.configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER settings_updated BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER TABLE public.configs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.configs;

-- Seed team
INSERT INTO public.team_members (name, role, initial, accent, sort_order) VALUES
  ('Shnwaz Dev', 'Lead Developer', 'S', 'cyan', 1),
  ('ShadowNet', 'Config Provider', 'N', 'purple', 2),
  ('VPN Master', 'Infrastructure', 'V', 'blue', 3),
  ('ZeroTrace', 'Community Mgr', 'Z', 'rose', 4);

-- Seed settings
INSERT INTO public.site_settings (key, value) VALUES
  ('telegram_url', 'https://t.me/yourchannel'),
  ('hero_tagline', 'Fastest Free VLESS, VMESS, TROJAN & SSH Configs. Bypass restrictions with military-grade encryption and zero logging.');
