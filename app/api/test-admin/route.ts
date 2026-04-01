import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";

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

    const { data, error } = await supabase
      .from("uploaded_files")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Admin client connected successfully",
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}