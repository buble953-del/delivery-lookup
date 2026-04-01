import * as XLSX from "xlsx";

export type ParsedShipment = {
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

function normalizeHeader(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizePhone(value: unknown) {
  return cleanText(value).replace(/\D/g, "");
}

function parseNumber(value: unknown): number | null {
  const text = cleanText(value).replace(/,/g, "");
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function toMonthKey(date: string) {
  return date.slice(0, 7);
}

function parseDateValue(value: unknown): string | null {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const text = cleanText(value);
  if (!text) return null;

  const normalized = text
    .replace(/\./g, "-")
    .replace(/\//g, "-")
    .replace(/\s+/g, "");

  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const yyyy = match[1];
    const mm = match[2].padStart(2, "0");
    const dd = match[3].padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const asDate = new Date(text);
  if (!Number.isNaN(asDate.getTime())) {
    const yyyy = asDate.getFullYear();
    const mm = String(asDate.getMonth() + 1).padStart(2, "0");
    const dd = String(asDate.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

function getValueByHeader(row: Record<string, unknown>, headerGroups: string[][]) {
  const entries = Object.entries(row);

  for (const [key, value] of entries) {
    const normalizedKey = normalizeHeader(key);

    const matched = headerGroups.some((group) =>
      group.every((token) => normalizedKey.includes(normalizeHeader(token)))
    );

    if (matched) {
      return value;
    }
  }

  return "";
}

export function parseShipmentsFromWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("엑셀 시트를 찾을 수 없습니다.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const shipments: ParsedShipment[] = [];
  let skippedCount = 0;

  for (const row of rows) {
    const shippedDateValue = getValueByHeader(row, [
      ["발송일", "日期"],
      ["日期"],
      ["발송일"],
    ]);

    const trackingValue = getValueByHeader(row, [
      ["송장번호", "单号"],
      ["单号"],
      ["송장번호"],
    ]);

    const recipientValue = getValueByHeader(row, [
      ["수취인", "收件人"],
      ["收件人"],
      ["수취인"],
    ]);

    const addressValue = getValueByHeader(row, [
      ["地址", "주소"],
      ["地址"],
      ["주소"],
    ]);

    const phoneValue = getValueByHeader(row, [
      ["电话", "전화"],
      ["电话"],
      ["전화"],
    ]);

    const itemValue = getValueByHeader(row, [
      ["상품명세", "物品"],
      ["物品"],
      ["상품명세"],
    ]);

    const remarkValue = getValueByHeader(row, [
      ["备注", "编号"],
      ["备注"],
      ["编号"],
    ]);

    const customsValue = getValueByHeader(row, [
      ["通过", "통관"],
      ["通过"],
      ["통관"],
    ]);

    const weightValue = getValueByHeader(row, [
      ["중량", "kg"],
      ["kg"],
      ["중량"],
    ]);

    const amountValue = getValueByHeader(row, [
      ["금액", "金额"],
      ["金额"],
      ["금액"],
    ]);

    const shippedDate = parseDateValue(shippedDateValue);
    const trackingNumber = cleanText(trackingValue);
    const phoneRaw = cleanText(phoneValue);
    const phoneNormalized = normalizePhone(phoneRaw);

    const recipientText = cleanText(recipientValue);

    const isSummaryRow =
      recipientText.includes("合计") ||
      recipientText.includes("총계") ||
      recipientText.includes("总");

    if (isSummaryRow) {
      skippedCount += 1;
      continue;
    }

    if (!shippedDate || !trackingNumber || !phoneNormalized) {
      skippedCount += 1;
      continue;
    }

    shipments.push({
      month_key: toMonthKey(shippedDate),
      shipped_date: shippedDate,
      tracking_number: trackingNumber,
      recipient_name: cleanText(recipientValue) || null,
      address: cleanText(addressValue) || null,
      phone_raw: phoneRaw || null,
      phone_normalized: phoneNormalized,
      item_name: cleanText(itemValue) || null,
      remark_no: cleanText(remarkValue) || null,
      customs_status: cleanText(customsValue) || null,
      weight_kg: parseNumber(weightValue),
      amount: parseNumber(amountValue),
    });
  }

  return {
    sheetName: firstSheetName,
    shipments,
    rowCountTotal: rows.length,
    rowCountValid: shipments.length,
    rowCountSkipped: skippedCount,
  };
}