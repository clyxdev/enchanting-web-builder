CREATE POLICY "Users can view their own config audit logs"
  ON public.config_audit_logs
  FOR SELECT
  TO authenticated
  USING (actor_id = auth.uid());