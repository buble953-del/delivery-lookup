"use client";

import { useEffect, useState } from "react";

type UploadSummary = {
  fileName: string;
  sheetName: string;
  targetMonthKey: string;
  totalRows: number;
  parsedRows: number;
  skippedInvalidRows: number;
  skippedOtherMonthRows: number;
  insertedRows: number;
};

type UploadHistoryItem = {
  id: number;
  file_name: string;
  month_key: string;
  uploaded_at: string;
};

type ProtectedPhoneItem = {
  id: number;
  phone_normalized: string;
  label: string | null;
  created_at: string;
};

function formatPhoneNumber(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 11);

  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  }
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
}

export default function AdminUploadClient() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [error, setError] = useState("");
  const [summary, setSummary] = useState<UploadSummary | null>(null);

  const [uploads, setUploads] = useState<UploadHistoryItem[]>([]);
  const [protectedPhones, setProtectedPhones] = useState<ProtectedPhoneItem[]>([]);
  const [protectedPhone, setProtectedPhone] = useState("");
  const [protectedLabel, setProtectedLabel] = useState("");
  const [protectedPassword, setProtectedPassword] = useState("");
  const [hasProtectedPassword, setHasProtectedPassword] = useState(false);

  // 디폴트 접힘
  const [isUploadsOpen, setIsUploadsOpen] = useState(false);
  const [isProtectedOpen, setIsProtectedOpen] = useState(false);

  async function loadDashboard() {
    setDashboardLoading(true);

    try {
      const res = await fetch("/api/admin/dashboard", {
        credentials: "include",
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setError(json.error || "관리자 데이터 조회 실패");
        return;
      }

      setUploads(json.uploads ?? []);
      setProtectedPhones(json.protectedPhones ?? []);
      setHasProtectedPassword(!!json.hasProtectedPassword);
    } catch {
      setError("관리자 데이터 조회 실패");
    } finally {
      setDashboardLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleUpload = async () => {
    if (!file) {
      setError("업로드할 엑셀 파일을 선택해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        setError(json.error || "업로드 중 오류가 발생했습니다.");
        return;
      }

      setSummary(json.summary);
      setFile(null);
      await loadDashboard();
    } catch {
      setError("업로드 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });

    window.location.replace("/admin/login");
  };

  const handleAddProtectedPhone = async () => {
    setError("");

    const phoneOnly = protectedPhone.replace(/\D/g, "");

    if (phoneOnly.length !== 11) {
      setError("보호 번호는 휴대폰번호 11자리를 정확히 입력해주세요.");
      return;
    }

    try {
      const res = await fetch("/api/admin/protected-phones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          phone: phoneOnly,
          label: protectedLabel,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setError(json.error || "보호 번호 저장 실패");
        return;
      }

      setProtectedPhone("");
      setProtectedLabel("");
      await loadDashboard();
    } catch {
      setError("보호 번호 저장 실패");
    }
  };

  const handleDeleteProtectedPhone = async (id: number) => {
    setError("");

    try {
      const res = await fetch(`/api/admin/protected-phones/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setError(json.error || "보호 번호 삭제 실패");
        return;
      }

      await loadDashboard();
    } catch {
      setError("보호 번호 삭제 실패");
    }
  };

  const handleSaveProtectedPassword = async () => {
    setError("");

    if (protectedPassword.trim().length < 4) {
      setError("보호 비밀번호는 4자 이상 입력해주세요.");
      return;
    }

    try {
      const res = await fetch("/api/admin/protected-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          password: protectedPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        setError(json.error || "보호 비밀번호 저장 실패");
        return;
      }

      setProtectedPassword("");
      await loadDashboard();
    } catch {
      setError("보호 비밀번호 저장 실패");
    }
  };

  return (
    <main className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 p-6 shadow-sm text-black">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-black mb-2">관리자 엑셀 업로드</h1>
            <p className="text-sm text-black">
              월별 엑셀 파일을 업로드하면 해당 월 데이터가 교체됩니다.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="shrink-0 rounded-xl border border-gray-400 px-4 py-2 text-sm text-black"
          >
            로그아웃
          </button>
        </div>

        <div className="space-y-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-black file:mr-4 file:rounded-lg file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
          />

          <button
            onClick={handleUpload}
            disabled={loading}
            className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50"
          >
            {loading ? "업로드 중..." : "엑셀 업로드"}
          </button>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {summary && (
          <div className="mt-6 rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-black mb-3">업로드 결과</h2>
            <div className="space-y-2 text-sm text-black">
              <p>파일명: {summary.fileName}</p>
              <p>시트명: {summary.sheetName}</p>
              <p>저장 대상 월: {summary.targetMonthKey}</p>
              <p>전체 행 수: {summary.totalRows}</p>
              <p>파싱된 행 수: {summary.parsedRows}</p>
              <p>형식 오류로 제외된 행 수: {summary.skippedInvalidRows}</p>
              <p>다른 달이라 제외된 행 수: {summary.skippedOtherMonthRows}</p>
              <p>실제 저장 행 수: {summary.insertedRows}</p>
            </div>
          </div>
        )}

        {/* 업로드 이력 */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={() => setIsUploadsOpen((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-4 text-left cursor-pointer hover:bg-gray-100 transition-colors duration-200 rounded-2xl"
          >
            <span className="text-lg font-semibold text-black">업로드 이력</span>
            <span
              className={`text-sm text-black transition-transform duration-300 ${
                isUploadsOpen ? "rotate-180" : "rotate-0"
              }`}
            >
              ▼
            </span>
          </button>

          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              isUploadsOpen ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="px-4 pb-4">
              {dashboardLoading ? (
                <p className="text-sm text-gray-700">불러오는 중...</p>
              ) : uploads.length === 0 ? (
                <p className="text-sm text-gray-700">업로드 이력이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {uploads.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-black"
                    >
                      <p>
                        <span className="font-semibold">업로드 일시:</span>{" "}
                        {new Date(item.uploaded_at).toLocaleString()}
                      </p>
                      <p>
                        <span className="font-semibold">파일명:</span> {item.file_name}
                      </p>
                      <p>
                        <span className="font-semibold">월:</span> {item.month_key}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 보호 번호 관리 */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={() => setIsProtectedOpen((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-4 text-left cursor-pointer hover:bg-gray-100 transition-colors duration-200 rounded-2xl"
          >
            <span className="text-lg font-semibold text-black">보호 번호 관리</span>
            <span
              className={`text-sm text-black transition-transform duration-300 ${
                isProtectedOpen ? "rotate-180" : "rotate-0"
              }`}
            >
              ▼
            </span>
          </button>

          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              isProtectedOpen ? "max-h-[1400px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="px-4 pb-4">
              <div className="space-y-3">
                <input
                  type="text"
                  value={protectedPhone}
                  onChange={(e) => setProtectedPhone(formatPhoneNumber(e.target.value))}
                  placeholder="보호할 번호 입력"
                  className="w-full rounded-xl border border-gray-400 bg-white px-4 py-3 text-black placeholder:text-gray-500"
                />
                <input
                  type="text"
                  value={protectedLabel}
                  onChange={(e) => setProtectedLabel(e.target.value)}
                  placeholder="메모 또는 라벨 (예: 관리자)"
                  className="w-full rounded-xl border border-gray-400 bg-white px-4 py-3 text-black placeholder:text-gray-500"
                />
                <button
                  onClick={handleAddProtectedPhone}
                  className="rounded-xl bg-black px-4 py-3 text-white"
                >
                  보호 번호 추가
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <p className="text-sm text-gray-700">
                  보호 비밀번호 상태: {hasProtectedPassword ? "설정됨" : "미설정"}
                </p>
                <input
                  type="password"
                  value={protectedPassword}
                  onChange={(e) => setProtectedPassword(e.target.value)}
                  placeholder="보호 번호 공통 비밀번호 설정"
                  className="w-full rounded-xl border border-gray-400 bg-white px-4 py-3 text-black placeholder:text-gray-500"
                />
                <button
                  onClick={handleSaveProtectedPassword}
                  className="rounded-xl border border-gray-400 bg-white px-4 py-3"
                >
                  보호 비밀번호 저장
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {protectedPhones.length === 0 ? (
                  <p className="text-sm text-gray-700">등록된 보호 번호가 없습니다.</p>
                ) : (
                  protectedPhones.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4"
                    >
                      <div className="text-sm text-black">
                        <p>
                          <span className="font-semibold">번호:</span> {item.phone_normalized}
                        </p>
                        <p>
                          <span className="font-semibold">라벨:</span> {item.label || "-"}
                        </p>
                        <p>
                          <span className="font-semibold">등록일:</span>{" "}
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDeleteProtectedPhone(item.id)}
                        className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}