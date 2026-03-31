export default function Page() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-2">배송조회</h1>
        <p className="text-sm text-gray-500 mb-6">
          휴대폰번호를 입력해 최근 20일 출고 송장을 조회하세요.
        </p>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="휴대폰번호 입력"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none"
          />
          <button className="w-full rounded-xl bg-black text-white py-3 font-medium">
            조회하기
          </button>
        </div>
      </div>
    </main>
  );
}