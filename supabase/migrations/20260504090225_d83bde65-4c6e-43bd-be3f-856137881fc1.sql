REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view active configs" ON public.configs;
CREATE POLICY "Anyone can view active configs"
  ON public.configs
  FOR SELECT
  TO public
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can insert configs" ON public.configs;
DROP POLICY IF EXISTS "Admins can update configs" ON public.configs;
DROP POLICY IF EXISTS "Admins can delete configs" ON public.configs;

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

DROP POLICY IF EXISTS "Admins can view config audit logs" ON public.config_audit_logs;
DROP POLICY IF EXISTS "Admins can create config audit logs" ON public.config_audit_logs;