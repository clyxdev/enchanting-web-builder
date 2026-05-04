CREATE TABLE IF NOT EXISTS public.admin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT 'Admin',
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_accounts_username ON public.admin_accounts (username);

ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct admin account access" ON public.admin_accounts;
CREATE POLICY "No direct admin account access"
  ON public.admin_accounts
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

DROP TRIGGER IF EXISTS admin_accounts_updated ON public.admin_accounts;
CREATE TRIGGER admin_accounts_updated BEFORE UPDATE ON public.admin_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();