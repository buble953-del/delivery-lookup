import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";
import { hashProtectedPassword } from "@/lib/protected-security";

function makePasswordHint(password: string) {
  if (password.length <= 2) return "*".repeat(password.length);
  if (password.length <= 4) return `${password[0]}${"*".repeat(password.length - 1)}`;

  const start = password.slice(0, 2);
  const end = password.slice(-2);
  const middle = "*".repeat(Math.max(2, password.length - 4));

  return `${start}${middle}${end}`;
}

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
    const enabled = !!body?.enabled;
    const password = String(body?.password ?? "").trim();

    const supabase = createAdminClient();

    const { data: settings, error: settingsError } = await supabase
      .from("admin_settings")
      .select("global_lookup_password_hash, global_lookup_password_hint")
      .eq("id", 1)
      .single();

    if (settingsError) {
      return NextResponse.json(
        { ok: false, error: settingsError.message },
        { status: 500 }
      );
    }

    let nextHash = settings?.global_lookup_password_hash ?? null;
    let nextHint = settings?.global_lookup_password_hint ?? null;

    if (password) {
      if (password.length < 4) {
        return NextResponse.json(
          { ok: false, error: "공통 비밀번호는 4자 이상 입력해주세요." },
          { status: 400 }
        );
      }

      nextHash = hashProtectedPassword(password);
      nextHint = makePasswordHint(password);
    }

    if (enabled && !nextHash) {
      return NextResponse.json(
        {
          ok: false,
          error: "전체 조회 비밀번호를 먼저 설정한 뒤 활성화해주세요.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("admin_settings")
      .update({
        global_lookup_enabled: enabled,
        global_lookup_password_hash: nextHash,
        global_lookup_password_hint: nextHint,
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

    return NextResponse.json({
      ok: true,
      enabled,
      hasPassword: !!nextHash,
      passwordHint: nextHint,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "전체 조회 비밀번호 저장 실패" },
      { status: 500 }
    );
  }
}