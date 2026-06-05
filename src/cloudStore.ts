import { createClient } from "@supabase/supabase-js";

const fallbackSupabaseUrl = "https://cuqgddgmpraichiqmjqh.supabase.co";
const fallbackSupabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cWdkZGdtcHJhaWNoaXFtanFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODQ0MDgsImV4cCI6MjA5NjI2MDQwOH0.Llqg-rk0ozalJSoJ3xeqPv2ipqRr8677mo_lIvqN4-I";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || fallbackSupabaseUrl;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || fallbackSupabaseAnonKey;

export const isCloudReady = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isCloudReady ? createClient(supabaseUrl!, supabaseAnonKey!) : null;

export async function cloudLoad<T>(key: string, fallback: T): Promise<T> {
  if (!supabase) return fallback;
  const { data, error } = await supabase.from("app_state").select("value").eq("key", key).maybeSingle();
  if (error || !data) return fallback;
  return data.value as T;
}

export async function cloudSave(key: string, value: unknown) {
  if (!supabase) return;
  await supabase.from("app_state").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
  });
}
