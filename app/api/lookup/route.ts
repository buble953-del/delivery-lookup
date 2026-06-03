import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupRateLimit } from "@/lib/ratelimit";
import { getProtectedConfig } from "@/lib/protected-config";
import { verifyProtectedPassword } from "@/lib/protected-security";

function normalizePhone(phone: string) {
  return String(phone || "").replace(/\D/g, "");
}

function getDate20DaysAgo() {
  const today = new Date();
  const past20Days = new Date();
  past20Days.setDate(today.getDate() - 20);

  const yyyy = past20Days.getFullYear();
  const mm = String(past20Days.getMonth() + 1).padStart(2, "0");
  const dd = String(past20Days.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

export async function POST(request: NextRequest) {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const ip = forwardedFor.split(",")[0]?.trim() || "127.0.0.1";

    const { success, limit, remaining, reset } =
      await lookupRateLimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          ok: false,
          error: "조회 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
          },
        }
      );
    }

    const body = await request.json();

    const normalizedPhone = normalizePhone(body?.phone ?? "");
    const lookupPassword = String(body?.lookupPassword ?? "").trim();

    if (!normalizedPhone) {
      return NextResponse.json(
        { ok: false, error: "휴대폰번호를 입력해주세요." },
        { status: 400 }
      );
    }

    if (normalizedPhone.length !== 11) {
      return NextResponse.json(
        { ok: false, error: "휴대폰번호 11자리를 정확히 입력해주세요." },
        { status: 400 }
      );
    }

    const {
      phones,
      protectedPasswordHash,
      globalLookupEnabled,
      globalLookupPasswordHash,
    } = await getProtectedConfig();

    const isProtectedPhone = phones.some(
      (item) => item.phone_normalized === normalizedPhone
    );

    if (isProtectedPhone) {
      const verified = verifyProtectedPassword(
        lookupPassword,
        protectedPasswordHash
      );

      if (!verified) {
        return NextResponse.json(
          {
            ok: false,
            requiresPassword: true,
            passwordScope: "protected",
            error: "이 번호는 보호 번호 비밀번호가 필요합니다.",
          },
          { status: 401 }
        );
      }
    } else if (globalLookupEnabled) {
      const verified = verifyProtectedPassword(
        lookupPassword,
        globalLookupPasswordHash
      );

      if (!verified) {
        return NextResponse.json(
          {
            ok: false,
            requiresPassword: true,
            passwordScope: "global",
            error: "조회 비밀번호를 입력해주세요.",
          },
          { status: 401 }
        );
      }
    }

    const supabase = await createClient();
    const fromDate = getDate20DaysAgo();

    const { data, error } = await supabase
      .from("shipments")
      .select("id, shipped_date, tracking_number, customs_status, item_name")
      .eq("phone_normalized", normalizedPhone)
      .gte("shipped_date", fromDate)
      .order("shipped_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        shipments: data ?? [],
      },
      {
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
        },
      }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}