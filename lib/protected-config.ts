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
        .select(
          "protected_password_hash, global_lookup_enabled, global_lookup_password_hash, global_lookup_password_hint"
        )
        .eq("id", 1)
        .single(),
    ]);

  if (phonesError) throw new Error(phonesError.message);
  if (settingsError) throw new Error(settingsError.message);

  return {
    phones: phones ?? [],
    protectedPasswordHash: settings?.protected_password_hash ?? null,
    globalLookupEnabled: !!settings?.global_lookup_enabled,
    globalLookupPasswordHash: settings?.global_lookup_password_hash ?? null,
    globalLookupPasswordHint: settings?.global_lookup_password_hint ?? null,
  };
}