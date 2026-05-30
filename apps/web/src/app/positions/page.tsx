'use client';

import { useEffect, useState } from 'react';
import { getPositions } from '@/lib/api';

interface Position {
  ticker: string;
  quantity: number;
  avgPrice: number;
  realizedPnl: number;
  currentPrice: number | null;
  unrealizedPnl: number | null;
  unrealizedPnlPct: number | null;
  stock?: { name: string; market: string };
}

function PnlText({ value, pct }: { value: number | null | undefined; pct?: number | null }) {
  if (value == null) return null;
  const positive = value >= 0;
  return (
    <span className={`text-sm font-medium ${positive ? 'text-green-600' : 'text-red-500'}`}>
      {positive ? '+' : ''}{value.toLocaleString()}원
      {pct != null && (
        <span className="ml-1 text-xs opacity-80">
          ({positive ? '+' : ''}{pct.toFixed(2)}%)
        </span>
      )}
    </span>
  );
}

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getPositions()
      .then((res) => setPositions(res as Position[]))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">불러오는 중...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  const totalUnrealized = positions.reduce((sum, p) => sum + (p.unrealizedPnl ?? 0), 0);
  const hasUnrealized = positions.some((p) => p.unrealizedPnl !== null);

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <h1 className="text-xl font-semibold">포지션</h1>
        {hasUnrealized && (
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-0.5">평가손익 합계</p>
            <PnlText value={totalUnrealized} />
          </div>
        )}
      </div>

      {positions.length === 0 ? (
        <p className="text-gray-400">보유 포지션이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {positions.map((p) => (
            <div key={p.ticker} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{p.stock?.name ?? p.ticker}</span>
                  <span className="ml-2 text-xs text-gray-400">{p.ticker}</span>
                  {p.stock?.market && (
                    <span className="ml-1.5 text-xs text-gray-300">{p.stock.market}</span>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  {Number(p.quantity).toLocaleString()}주
                </span>
              </div>

              <div className="mt-2 text-sm text-gray-500">
                평균단가 {Number(p.avgPrice).toLocaleString()}원
                {p.currentPrice != null && (
                  <span className="ml-2 text-gray-400">
                    현재 {p.currentPrice.toLocaleString()}원
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {p.unrealizedPnl != null ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">평가손익</span>
                    <PnlText value={p.unrealizedPnl} pct={p.unrealizedPnlPct} />
                  </div>
                ) : (
                  <span className="text-xs text-gray-300">현재가 조회 불가</span>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">실현손익</span>
                  <PnlText value={Number(p.realizedPnl)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
