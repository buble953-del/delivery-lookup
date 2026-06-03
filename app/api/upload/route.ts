import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseShipmentsFromWorkbook } from "@/lib/shipments/parse-excel";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";

type ShipmentRow = {
  month_key: string;
  shipped_date: string;
  tracking_number: string;
  recipient_name: string | null;
  address: string | null;
  phone_raw: string | null;
  phone_normalized: string;
  item_name: string | null;
  remark_no: string | null;
  customs_status: string | null;
  weight_kg: number | null;
  amount: number | null;
};

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function getDateCutoffString(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function getUploadedAtCutoffIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function getDominantMonthKey(items: { month_key: string }[]) {
  if (items.length === 0) return null;

  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.month_key, (counts.get(item.month_key) ?? 0) + 1);
  }

  let bestMonthKey: string | null = null;
  let bestCount = 0;

  for (const [monthKey, count] of counts.entries()) {
    if (count > bestCount) {
      bestMonthKey = monthKey;
      bestCount = count;
    }
  }

  return bestMonthKey;
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
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "엑셀 파일을 선택해주세요." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const parsed = parseShipmentsFromWorkbook(buffer);

    if (parsed.shipments.length === 0) {
      return NextResponse.json(
        { ok: false, error: "저장할 수 있는 출고 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const shippedDateCutoff = getDateCutoffString(30);

    const filteredShipments = parsed.shipments.filter(
      (item: ShipmentRow) => item.shipped_date >= shippedDateCutoff
    );

    const outsideRangeSkippedRows =
      parsed.shipments.length - filteredShipments.length;

    if (filteredShipments.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "최근 30일 기준으로 저장할 수 있는 출고 데이터가 없습니다.",
        },
        { status: 400 }
      );
    }

    const displayMonthKey =
      getDominantMonthKey(filteredShipments) ??
      getDominantMonthKey(parsed.shipments) ??
      null;

    const supabase = createAdminClient();

    const { data: uploadedFile, error: uploadLogError } = await supabase
      .from("uploaded_files")
      .insert({
        file_name: file.name,
        month_key: displayMonthKey,
        row_count_total: parsed.rowCountTotal,
        row_count_valid: filteredShipments.length,
        row_count_skipped: parsed.rowCountSkipped + outsideRangeSkippedRows,
      })
      .select("id")
      .single();

    if (uploadLogError || !uploadedFile) {
      return NextResponse.json(
        { ok: false, error: uploadLogError?.message || "업로드 로그 저장 실패" },
        { status: 500 }
      );
    }

    const sourceFileId = uploadedFile.id;

    const rowsToUpsert = filteredShipments.map((item: ShipmentRow) => ({
      ...item,
      source_file_id: sourceFileId,
    }));

    const chunks = chunkArray(rowsToUpsert, 500);

    for (const chunk of chunks) {
      const { error } = await supabase.from("shipments").upsert(chunk, {
        onConflict: "tracking_number",
      });

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    }

    const { error: cleanupShipmentsError } = await supabase
      .from("shipments")
      .delete()
      .lt("shipped_date", shippedDateCutoff);

    if (cleanupShipmentsError) {
      return NextResponse.json(
        { ok: false, error: cleanupShipmentsError.message },
        { status: 500 }
      );
    }

    const { error: cleanupUploadHistoryError } = await supabase
      .from("uploaded_files")
      .delete()
      .lt("uploaded_at", getUploadedAtCutoffIso(30));

    if (cleanupUploadHistoryError) {
      return NextResponse.json(
        { ok: false, error: cleanupUploadHistoryError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "엑셀 업로드가 완료되었습니다.",
      summary: {
        fileName: file.name,
        sheetName: parsed.sheetName,
        targetMonthKey: displayMonthKey,
        totalRows: parsed.rowCountTotal,
        parsedRows: parsed.shipments.length,
        skippedInvalidRows: parsed.rowCountSkipped,
        skippedOtherMonthRows: outsideRangeSkippedRows,
        insertedRows: rowsToUpsert.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "업로드 중 알 수 없는 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}