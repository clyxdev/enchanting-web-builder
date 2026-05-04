GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.config_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid,
  config_name text NOT NULL DEFAULT '',
  protocol public.config_protocol,
  action text NOT NULL,
  actor_id uuid NOT NULL,
  actor_name text NOT NULL DEFAULT 'admin',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT config_audit_logs_action_check CHECK (action IN ('created', 'updated', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_config_audit_logs_created_at ON public.config_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_audit_logs_config_id ON public.config_audit_logs (config_id);

ALTER TABLE public.config_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view config audit logs" ON public.config_audit_logs;
CREATE POLICY "Admins can view config audit logs"
  ON public.config_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can create config audit logs" ON public.config_audit_logs;
CREATE POLICY "Admins can create config audit logs"
  ON public.config_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND actor_id = auth.uid());

ALTER TABLE public.config_audit_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.config_audit_logs;