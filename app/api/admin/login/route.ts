import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    const adminPassword = process.env.ADMIN_PASSWORD?.trim();
    const adminToken = process.env.ADMIN_AUTH_TOKEN?.trim();

    if (!adminPassword || !adminToken) {
      return NextResponse.json(
        { ok: false, error: "관리자 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { ok: false, error: "비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    if (password !== adminPassword) {
      return NextResponse.json(
        { ok: false, error: "비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set("admin_auth", adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}