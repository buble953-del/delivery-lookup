import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseShipmentsFromWorkbook } from "@/lib/shipments/parse-excel";
import { isAdminAuthed } from "@/lib/admin-auth";

export const runtime = "nodejs";

function getKeepFromMonthKey() {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function getMonthKeyFromFileName(fileName: string) {
  const match = fileName.match(/(20\d{2})[-_.](0?[1-9]|1[0-2])/);
  if (!match) return null;

  const yyyy = match[1];
  const mm = match[2].padStart(2, "0");
  return `${yyyy}-${mm}`;
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

    const monthKeyFromFileName = getMonthKeyFromFileName(file.name);
    const dominantMonthKey = getDominantMonthKey(parsed.shipments);
    const targetMonthKey = monthKeyFromFileName ?? dominantMonthKey;

    if (!targetMonthKey) {
      return NextResponse.json(
        { ok: false, error: "업로드 대상 월을 판단할 수 없습니다." },
        { status: 400 }
      );
    }

    const filteredShipments = parsed.shipments.filter(
      (item) => item.month_key === targetMonthKey
    );

    const otherMonthSkippedRows =
      parsed.shipments.length - filteredShipments.length;

    if (filteredShipments.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `파일명 기준 월(${targetMonthKey})에 해당하는 데이터가 없습니다.`,
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: uploadedFile, error: uploadLogError } = await supabase
      .from("uploaded_files")
      .insert({
        file_name: file.name,
        month_key: targetMonthKey,
        row_count_total: parsed.rowCountTotal,
        row_count_valid: filteredShipments.length,
        row_count_skipped: parsed.rowCountSkipped + otherMonthSkippedRows,
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

    const { error: deleteMonthError } = await supabase
      .from("shipments")
      .delete()
      .eq("month_key", targetMonthKey);

    if (deleteMonthError) {
      return NextResponse.json(
        { ok: false, error: deleteMonthError.message },
        { status: 500 }
      );
    }

    const rowsToInsert = filteredShipments.map((item) => ({
      ...item,
      source_file_id: sourceFileId,
    }));

    const chunks = chunkArray(rowsToInsert, 500);

    for (const chunk of chunks) {
      const { error } = await supabase.from("shipments").insert(chunk);
      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
    }

    const keepFromMonthKey = getKeepFromMonthKey();

    const { error: cleanupError } = await supabase
      .from("shipments")
      .delete()
      .lt("month_key", keepFromMonthKey);

      const { error: uploadHistoryCleanupError } = await supabase
  .from("uploaded_files")
  .delete()
  .lt("month_key", keepFromMonthKey);

if (uploadHistoryCleanupError) {
  return NextResponse.json(
    { ok: false, error: uploadHistoryCleanupError.message },
    { status: 500 }
  );
}

    if (cleanupError) {
      return NextResponse.json(
        { ok: false, error: cleanupError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "엑셀 업로드가 완료되었습니다.",
      summary: {
        fileName: file.name,
        sheetName: parsed.sheetName,
        targetMonthKey,
        totalRows: parsed.rowCountTotal,
        parsedRows: parsed.shipments.length,
        skippedInvalidRows: parsed.rowCountSkipped,
        skippedOtherMonthRows: otherMonthSkippedRows,
        insertedRows: rowsToInsert.length,
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