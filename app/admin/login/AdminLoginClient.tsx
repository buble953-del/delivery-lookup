"use client";

import { useState } from "react";

export default function AdminLoginClient() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!password) {
      setError("비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
        credentials: "include",
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        setError(json.error || "로그인에 실패했습니다.");
        return;
      }

      window.location.replace("/admin/upload");
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 p-6 shadow-sm text-black">
        <h1 className="text-2xl font-bold text-black mb-2">관리자 로그인</h1>
        <p className="text-sm text-black mb-6">
          관리자 비밀번호를 입력하세요.
        </p>

        <div className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="관리자 비밀번호"
            className="w-full rounded-xl border border-gray-400 px-4 py-3 text-black placeholder:text-gray-500 outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
          />

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-xl bg-black text-white py-3 font-medium disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}