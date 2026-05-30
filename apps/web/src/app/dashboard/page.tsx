'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPositions, getTrades, request } from '@/lib/api';

interface Position {
  ticker: string;
  quantity: number;
  avgPrice: number;
  unrealizedPnl: number | null;
  stock?: { name: string };
}

interface Trade {
  id: string;
  ticker: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  tradedAt: string;
  stock?: { name: string };
}

interface QuickStats {
  tradeCount: number;
  totalRealizedPnl: number;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getPositions().then((r) => setPositions(r as Position[])),
      getTrades({ limit: 5, sort: 'tradedAt', order: 'DESC' }).then((r) => {
        const res = r as { data: Trade[] };
        setRecentTrades(res.data ?? []);
      }),
      request<QuickStats>('/api/journal/trades/stats/quick').then(setStats),
    ]).finally(() => setLoading(false));
  }, []);

  const totalUnrealized = positions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0);
  const holdingCount = positions.filter((p) => Number(p.quantity) > 0).length;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">홈</h1>

      {/* 통계 카드 */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="보유 종목"
            value={`${holdingCount}종목`}
            sub={`평가손익 ${totalUnrealized >= 0 ? '+' : ''}${Math.round(totalUnrealized).toLocaleString()}원`}
          />
          <StatCard
            label="총 매매 횟수"
            value={`${stats?.tradeCount ?? '-'}회`}
          />
          <StatCard
            label="실현손익 합계"
            value={`${(stats?.totalRealizedPnl ?? 0) >= 0 ? '+' : ''}${Math.round(stats?.totalRealizedPnl ?? 0).toLocaleString()}원`}
          />
        </div>
      )}

      {/* 최근 매매 */}
      {recentTrades.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">최근 매매</p>
            <Link href="/trades" className="text-xs text-blue-600 hover:underline">전체 보기</Link>
          </div>
          <ul className="divide-y divide-gray-50">
            {recentTrades.map((t) => (
              <li key={t.id} className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${t.side === 'BUY' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                    {t.side === 'BUY' ? '매수' : '매도'}
                  </span>
                  <span className="text-sm text-gray-800">{t.stock?.name ?? t.ticker}</span>
                  <span className="text-xs text-gray-400">{Number(t.quantity).toLocaleString()}주</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(t.tradedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 바로가기 */}
      <div className="grid grid-cols-2 gap-3">
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
        <Link href="/coaching" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
          <p className="text-2xl mb-2">🧠</p>
          <p className="font-medium">월간 코칭</p>
          <p className="text-sm text-gray-500 mt-1">AI 매매 패턴 분석</p>
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
