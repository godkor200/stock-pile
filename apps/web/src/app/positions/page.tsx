'use client';

import { useEffect, useState } from 'react';
import { getPositions } from '@/lib/api';

interface Position {
  ticker: string;
  quantity: number;
  avgPrice: number;
  realizedPnl: number;
  stock?: { name: string; market: string };
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

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">포지션</h1>
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
                </div>
                <span className="text-sm text-gray-500">
                  {Number(p.quantity).toLocaleString()}주
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                평균단가 {Number(p.avgPrice).toLocaleString()}원
              </div>
              <div
                className={`mt-1 text-sm font-medium ${
                  Number(p.realizedPnl) >= 0 ? 'text-red-600' : 'text-blue-600'
                }`}
              >
                실현손익 {Number(p.realizedPnl) >= 0 ? '+' : ''}
                {Number(p.realizedPnl).toLocaleString()}원
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
