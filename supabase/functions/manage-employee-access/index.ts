import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Sesión requerida.");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) throw new Error("Sesión inválida.");
    const admin = createClient(url, serviceKey);
    const { data: callerProfile } = await admin.from("profiles").select("employee_number,active").eq("user_id", callerData.user.id).single();
    if (!callerProfile?.active || !["001", "002", "003", "005"].includes(callerProfile.employee_number)) throw new Error("No tienes autorización para administrar accesos.");

    const body = await request.json();
    const employeeNumber = String(body.employeeNumber || "").replace(/[^0-9]/g, "");
    const password = String(body.password || "");
    if (!employeeNumber || !body.name || !body.role || !body.branch) throw new Error("Datos incompletos del colaborador.");
    if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) throw new Error("La contraseña temporal requiere 10 caracteres, mayúscula, minúscula y número.");
    const email = `${employeeNumber}@usuarios.xoxo-ferreton.local`;
    const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    let target = users.users.find((user) => user.email === email);
    if (target) {
      const { data, error } = await admin.auth.admin.updateUserById(target.id, { password, user_metadata: { ...target.user_metadata, employee_number: employeeNumber, must_change_password: true } });
      if (error) throw error;
      target = data.user;
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { employee_number: employeeNumber, must_change_password: true } });
      if (error) throw error;
      target = data.user;
    }
    const { error: profileError } = await admin.from("profiles").upsert({ user_id: target.id, employee_number: employeeNumber, display_name: body.name, role: body.role, branch: body.branch, active: true, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (profileError) throw profileError;
    await admin.from("audit_log").insert({ table_name: "profiles", record_key: employeeNumber, action: "UPDATE", new_value: { event: "employee_access_reset", must_change_password: true }, changed_by: callerData.user.id });
    return new Response(JSON.stringify({ success: true, created: !users.users.some((user) => user.email === email) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "No se pudo administrar el acceso." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
