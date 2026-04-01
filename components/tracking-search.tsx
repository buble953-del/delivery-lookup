"use client";

import { useState } from "react";

type Shipment = {
  id: number;
  shipped_date: string;
  tracking_number: string;
  customs_status: string | null;
  item_name: string | null;
};

function formatStatus(status: string | null) {
  if (!status) return "-";

  const normalized = status.trim();

  if (normalized === "到达") return "배송완료";

  return normalized;
}

function isDelivered(status: string | null) {
  if (!status) return false;
  return status.trim() === "到达";
}

function formatPhoneNumber(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 11);

  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  }
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
}

export default function TrackingSearch() {
  const [phone, setPhone] = useState("");
  const [protectedPassword, setProtectedPassword] = useState("");
  const [needsProtectedPassword, setNeedsProtectedPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [searched, setSearched] = useState(false);

  // 디폴트 접힘
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);

  async function handleSearch() {
    setLoading(true);
    setError("");
    setShipments([]);
    setSearched(true);

    try {
      const normalizedPhone = phone.replace(/\D/g, "");

      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          protectedPassword,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.ok) {
        if (result.requiresPassword) {
          setNeedsProtectedPassword(true);
          setError(result.error ?? "이 번호는 추가 비밀번호가 필요합니다.");
          setShipments([]);
          setSearched(false);
          return;
        }

        setError(result.error ?? "조회 중 오류가 발생했습니다.");
        setShipments([]);
        return;
      }

      setNeedsProtectedPassword(false);
      setError("");
      setShipments(result.shipments ?? []);
    } catch {
      setError("조회 중 오류가 발생했습니다.");
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }

  async function copyTrackingNumber(trackingNumber: string) {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      alert("송장번호가 복사되었습니다.");
    } catch {
      alert("복사에 실패했습니다.");
    }
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 p-6 shadow-sm text-black">
        <h1 className="text-2xl font-bold text-black mb-2">배송조회</h1>
        <p className="text-sm text-black mb-6">
          휴대폰번호를 입력해 출고 송장을 조회하세요. (CJ대한통운)
        </p>

        <div className="mt-5 mb-5 rounded-xl border border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={() => setIsNoticeOpen((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-4 text-left cursor-pointer hover:bg-gray-100 transition-colors duration-200 rounded-xl"
          >
            <span className="text-sm font-semibold text-black">안내사항</span>
            <span
              className={`text-sm text-black transition-transform duration-300 ${
                isNoticeOpen ? "rotate-180" : "rotate-0"
              }`}
            >
              ▼
            </span>
          </button>

          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              isNoticeOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="px-4 pb-4 space-y-2 text-sm text-gray-800 leading-6">
              <p>* 모든 제품은 검수과정을 거쳐서 출고됩니다.</p>
              <p>* 검수가 완료되면 출고가 진행되며, 출고 송장이 조회됩니다.</p>
              <p>* 송장은 있으나 배송 조회가 되지 않을 경우, 해외 통관중입니다.</p>
              <p>* 국내 입항 시 조회가 시작되니 조금만 기다려 주세요!</p>
              <p>* 통관 기간은 예측이 불가합니다.</p>
              <p>* 통관 완료 후 1~2일 내 도착합니다.</p>
              <p>* 감사합니다.</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={phone}
            onChange={(e) => {
              setPhone(formatPhoneNumber(e.target.value));
              setSearched(false);
              setError("");
              setShipments([]);
              setNeedsProtectedPassword(false);
              setProtectedPassword("");
            }}
            placeholder="휴대폰번호(11자리) 입력"
            className="w-full rounded-xl border border-gray-600 px-4 py-3 text-black placeholder:text-gray-500 outline-none"
          />

          {needsProtectedPassword && (
            <input
              type="password"
              value={protectedPassword}
              onChange={(e) => setProtectedPassword(e.target.value)}
              placeholder="추가 비밀번호 입력"
              className="w-full rounded-xl border border-gray-600 px-4 py-3 text-black placeholder:text-gray-500 outline-none"
            />
          )}

          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full rounded-xl bg-black text-white py-3 font-medium disabled:opacity-50"
          >
            {loading ? "조회 중..." : "조회하기"}
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {!loading && !error && shipments.length > 0 && (
          <div className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold text-black">조회 결과</h2>

            {shipments.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl p-4 space-y-2 text-black ${
                  isDelivered(item.customs_status)
                    ? "border border-green-500 bg-green-50"
                    : "border border-gray-200 bg-white"
                }`}
              >
                <div className="text-sm text-black">
                  <span className="font-semibold">출고일:</span> {item.shipped_date}
                </div>
                <div className="text-sm text-black">
                  <span className="font-semibold">송장번호:</span> {item.tracking_number}
                </div>
                <div className="text-sm text-black">
                  <span className="font-semibold">상태:</span> {formatStatus(item.customs_status)}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => copyTrackingNumber(item.tracking_number)}
                    className="flex-1 rounded-lg border border-gray-400 py-2 text-sm text-black"
                  >
                    송장번호 복사
                  </button>
                  <a
                    href="https://www.shiptrack.co.kr/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 rounded-lg bg-black text-white py-2 text-sm text-center"
                  >
                    ShipTrack 이동
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {searched &&
          !loading &&
          !error &&
          !needsProtectedPassword &&
          shipments.length === 0 && (
            <p className="mt-4 text-sm text-gray-700">
              최근 20일 내 조회 가능한 송장이 없습니다.
            </p>
          )}
      </div>
    </main>
  );
}