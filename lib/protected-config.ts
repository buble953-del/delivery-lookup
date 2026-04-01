import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getProtectedConfig() {
  const supabase = createAdminClient();

  const [{ data: phones, error: phonesError }, { data: settings, error: settingsError }] =
    await Promise.all([
      supabase
        .from("protected_phones")
        .select("id, phone_normalized, label, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("admin_settings")
        .select("protected_password_hash")
        .eq("id", 1)
        .single(),
    ]);

  if (phonesError) throw new Error(phonesError.message);
  if (settingsError) throw new Error(settingsError.message);

  return {
    phones: phones ?? [],
    protectedPasswordHash: settings?.protected_password_hash ?? null,
  };
}