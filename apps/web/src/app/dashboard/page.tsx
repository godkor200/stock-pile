import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">홈</h1>
      <div className="grid grid-cols-2 gap-4">
        <Link href="/chat" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
          <p className="text-2xl mb-2">💬</p>
          <p className="font-medium">매매 입력</p>
          <p className="text-sm text-gray-500 mt-1">자연어로 매매 기록</p>
        </Link>
        <Link href="/reports" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
          <p className="text-2xl mb-2">📊</p>
          <p className="font-medium">종목 분석</p>
          <p className="text-sm text-gray-500 mt-1">AI 리포트 생성</p>
        </Link>
        <Link href="/trades" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
          <p className="text-2xl mb-2">📋</p>
          <p className="font-medium">거래 내역</p>
          <p className="text-sm text-gray-500 mt-1">매매 기록 조회</p>
        </Link>
        <Link href="/positions" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
          <p className="text-2xl mb-2">💼</p>
          <p className="font-medium">포지션</p>
          <p className="text-sm text-gray-500 mt-1">보유 현황</p>
        </Link>
      </div>
    </div>
  );
}
