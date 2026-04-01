import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";
import { hashProtectedPassword } from "@/lib/protected-security";

export async function POST(request: NextRequest) {
  const adminCookie = request.cookies.get("admin_auth")?.value;

  if (!isAdminAuthed(adminCookie)) {
    return NextResponse.json(
      { ok: false, error: "관리자 로그인이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const password = String(body?.password ?? "").trim();

    if (password.length < 4) {
      return NextResponse.json(
        { ok: false, error: "비밀번호는 4자 이상 입력해주세요." },
        { status: 400 }
      );
    }

    const passwordHash = hashProtectedPassword(password);
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("admin_settings")
      .update({
        protected_password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "보호 비밀번호 저장 실패" },
      { status: 500 }
    );
  }
}