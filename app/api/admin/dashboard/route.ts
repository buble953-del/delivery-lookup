import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getProtectedConfig } from "@/lib/protected-config";

function getUploadedAtCutoffIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export async function GET(request: NextRequest) {
  const adminCookie = request.cookies.get("admin_auth")?.value;

  if (!isAdminAuthed(adminCookie)) {
    return NextResponse.json(
      { ok: false, error: "관리자 로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const supabase = createAdminClient();

    await supabase
      .from("uploaded_files")
      .delete()
      .lt("uploaded_at", getUploadedAtCutoffIso(30));

    const [{ data: uploads, error: uploadError }, protectedConfig] =
      await Promise.all([
        supabase
          .from("uploaded_files")
          .select("id, file_name, month_key, uploaded_at")
          .order("uploaded_at", { ascending: false })
          .limit(20),
        getProtectedConfig(),
      ]);

    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: uploadError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      uploads: uploads ?? [],
      protectedPhones: protectedConfig.phones,
      hasProtectedPassword: !!protectedConfig.protectedPasswordHash,
      globalLookupEnabled: protectedConfig.globalLookupEnabled,
      hasGlobalLookupPassword: !!protectedConfig.globalLookupPasswordHash,
      globalLookupPasswordHint: protectedConfig.globalLookupPasswordHint,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "조회 실패",
      },
      { status: 500 }
    );
  }
}