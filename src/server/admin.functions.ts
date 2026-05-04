import { createServerFn } from "@tanstack/react-start";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const protocolSchema = z.enum(["VLESS", "VMESS", "TROJAN", "SSH"]);

const configSchema = z.object({
  name: z.string().trim().min(1).max(120),
  protocol: protocolSchema,
  server: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  config_string: z.string().trim().min(1).max(4000),
  country: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(255).optional().or(z.literal("")),
  is_active: z.boolean(),
});

const tokenSchema = z.object({ token: z.string().min(32) });
const loginSchema = z.object({
  username: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(120),
});

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

async function requireAdmin(token: string) {
  const tokenHash = sha256(token);
  const { data: session, error } = await supabaseAdmin
    .from("admin_sessions")
    .select("id, admin_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !session || new Date(session.expires_at).getTime() <= Date.now())
    throw new Error("Unauthorized");

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("admin_accounts")
    .select("id, username, display_name, is_active")
    .eq("id", session.admin_id)
    .maybeSingle();

  if (adminError || !admin?.is_active) throw new Error("Unauthorized");
  await supabaseAdmin
    .from("admin_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", session.id);
  return admin;
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    const username = data.username.toLowerCase();
    const { data: admin, error } = await supabaseAdmin
      .from("admin_accounts")
      .select("id, username, display_name, password_salt, password_hash, is_active")
      .eq("username", username)
      .maybeSingle();

    const digest = admin ? sha256(`${admin.password_salt}:${data.password}`) : "";
    if (
      error ||
      !admin?.is_active ||
      !safeEqualHex(digest.padEnd(64, "0"), (admin?.password_hash ?? "").padEnd(64, "0"))
    ) {
      throw new Error("Invalid credentials");
    }

    const token = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    const { error: sessionError } = await supabaseAdmin
      .from("admin_sessions")
      .insert({ admin_id: admin.id, token_hash: sha256(token), expires_at: expires });

    if (sessionError) throw sessionError;
    return { token, admin: { username: admin.username, display_name: admin.display_name } };
  });

export const adminLogout = createServerFn({ method: "POST" })
  .inputValidator((data) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    await supabaseAdmin.from("admin_sessions").delete().eq("token_hash", sha256(data.token));
    return { ok: true };
  });

export const getAdminDashboard = createServerFn({ method: "POST" })
  .inputValidator((data) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin(data.token);
    const [{ data: configs, error: configError }, { data: logs, error: logError }] =
      await Promise.all([
        supabaseAdmin.from("configs").select("*").order("created_at", { ascending: false }),
        supabaseAdmin
          .from("config_audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(12),
      ]);
    if (configError) throw configError;
    if (logError) throw logError;
    return { configs: configs ?? [], logs: logs ?? [] };
  });

export const saveAdminConfig = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({ token: z.string().min(32), id: z.string().uuid().optional(), config: configSchema })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.token);
    const result = data.id
      ? await supabaseAdmin
          .from("configs")
          .update(data.config)
          .eq("id", data.id)
          .select("*")
          .single()
      : await supabaseAdmin.from("configs").insert(data.config).select("*").single();
    if (result.error) throw result.error;

    await supabaseAdmin.from("config_audit_logs").insert({
      config_id: result.data.id,
      config_name: result.data.name,
      protocol: result.data.protocol,
      action: data.id ? "updated" : "created",
      actor_id: admin.id,
      actor_name: admin.display_name || admin.username,
      metadata: {
        server: result.data.server,
        port: result.data.port,
        active: result.data.is_active,
      },
    });
    return result.data;
  });

export const deleteAdminConfig = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ token: z.string().min(32), id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.token);
    const { data: existing, error: readError } = await supabaseAdmin
      .from("configs")
      .select("*")
      .eq("id", data.id)
      .single();
    if (readError) throw readError;
    const { error } = await supabaseAdmin.from("configs").delete().eq("id", data.id);
    if (error) throw error;
    await supabaseAdmin.from("config_audit_logs").insert({
      config_id: existing.id,
      config_name: existing.name,
      protocol: existing.protocol,
      action: "deleted",
      actor_id: admin.id,
      actor_name: admin.display_name || admin.username,
      metadata: { server: existing.server, port: existing.port },
    });
    return { ok: true };
  });
