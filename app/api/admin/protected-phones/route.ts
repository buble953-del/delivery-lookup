import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminAuthed } from "@/lib/admin-auth";

function normalizePhone(phone: string) {
  return String(phone || "").replace(/\D/g, "");
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
    const phone = normalizePhone(body?.phone ?? "");
    const label = String(body?.label ?? "").trim() || null;

    if (phone.length !== 11) {
      return NextResponse.json(
        { ok: false, error: "휴대폰번호 11자리를 정확히 입력해주세요." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("protected_phones")
      .upsert(
        { phone_normalized: phone, label },
        { onConflict: "phone_normalized" }
      )
      .select("id, phone_normalized, label, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, item: data });
  } catch {
    return NextResponse.json(
      { ok: false, error: "보호 번호 저장 실패" },
      { status: 500 }
    );
  }
}