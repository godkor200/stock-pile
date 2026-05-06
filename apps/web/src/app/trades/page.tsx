'use client';

import { useEffect, useState } from 'react';
import { getTrades } from '@/lib/api';

interface Trade {
  id: string;
  ticker: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  tradedAt: string;
  reason?: string;
  stock?: { name: string };
}

interface PaginatedTrades {
  data: Trade[];
  total: number;
  page: number;
  totalPages: number;
}

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getTrades()
      .then((res) => setTrades((res as PaginatedTrades).data ?? []))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-400">불러오는 중...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">거래 내역</h1>
      {trades.length === 0 ? (
        <p className="text-gray-400">아직 거래 내역이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {trades.map((t) => (
            <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      t.side === 'BUY'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {t.side === 'BUY' ? '매수' : '매도'}
                  </span>
                  <div>
                    <span className="font-medium">{t.stock?.name ?? t.ticker}</span>
                    {t.stock?.name && t.stock.name !== t.ticker && (
                      <span className="ml-2 text-xs text-gray-400">{t.ticker}</span>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(t.tradedAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                {t.quantity.toLocaleString()}주 × {t.price.toLocaleString()}원 ={' '}
                <span className="font-medium">
                  {(t.quantity * t.price).toLocaleString()}원
                </span>
              </div>
              {t.reason && (
                <p className="mt-1 text-xs text-gray-400">{t.reason}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
