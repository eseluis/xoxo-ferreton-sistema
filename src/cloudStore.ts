import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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
