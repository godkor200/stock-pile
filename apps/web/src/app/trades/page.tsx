'use client';

import { useEffect, useState, useCallback } from 'react';
import { getTrades, type TradeFilter } from '@/lib/api';

interface Trade {
  id: string;
  ticker: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  tradedAt: string;
  reason?: string;
  emotion?: string;
  source?: string;
  stock?: { name: string };
}

interface PaginatedTrades {
  data: Trade[];
  total: number;
  page: number;
  totalPages: number;
}

const EMOTION_LABEL: Record<string, string> = {
  PLANNED: '계획',
  IMPULSIVE: '충동',
  NEWS_REACTION: '뉴스',
  TECHNICAL: '기술',
  FOMO: 'FOMO',
};

const PAGE_SIZE = 20;

export default function TradesPage() {
  const [result, setResult] = useState<PaginatedTrades>({ data: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [ticker, setTicker] = useState('');
  const [side, setSide] = useState<'' | 'BUY' | 'SELL'>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('tradedAt');
  const [order, setOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    const filter: TradeFilter = {
      ticker: ticker || undefined,
      side: side || undefined,
      from: from || undefined,
      to: to || undefined,
      sort,
      order,
      page,
      limit: PAGE_SIZE,
    };
    getTrades(filter)
      .then((res) => setResult(res as PaginatedTrades))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [ticker, side, from, to, sort, order, page]);

  useEffect(() => {
    load();
  }, [load]);

  function handleFilterChange() {
    setPage(1);
  }

  function toggleOrder() {
    setOrder((o) => (o === 'DESC' ? 'ASC' : 'DESC'));
    setPage(1);
  }

  const totalAmount = result.data.reduce((sum, t) => sum + t.quantity * t.price, 0);
  const buyCount = result.data.filter((t) => t.side === 'BUY').length;
  const sellCount = result.data.filter((t) => t.side === 'SELL').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">거래 내역</h1>
        <span className="text-sm text-gray-400">총 {result.total.toLocaleString()}건</span>
      </div>

      {/* 필터 바 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="종목명 / 티커"
            value={ticker}
            onChange={(e) => { setTicker(e.target.value); handleFilterChange(); }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />

          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {(['', 'BUY', 'SELL'] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setSide(v); handleFilterChange(); }}
                className={`px-3 py-1.5 ${
                  side === v
                    ? v === 'BUY'
                      ? 'bg-red-500 text-white'
                      : v === 'SELL'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {v === '' ? '전체' : v === 'BUY' ? '매수' : '매도'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-sm text-gray-500">
            <span>기간</span>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); handleFilterChange(); }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <span>~</span>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); handleFilterChange(); }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="tradedAt">날짜순</option>
              <option value="price">단가순</option>
              <option value="quantity">수량순</option>
            </select>
            <button
              onClick={toggleOrder}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50"
              title={order === 'DESC' ? '내림차순' : '오름차순'}
            >
              {order === 'DESC' ? '↓' : '↑'}
            </button>
          </div>
        </div>

        {(ticker || side || from || to) && (
          <button
            onClick={() => {
              setTicker(''); setSide(''); setFrom(''); setTo(''); setPage(1);
            }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* 이번 페이지 요약 */}
      {result.data.length > 0 && (
        <div className="flex gap-4 text-sm text-gray-500">
          <span>매수 <strong className="text-red-500">{buyCount}</strong>건</span>
          <span>매도 <strong className="text-blue-500">{sellCount}</strong>건</span>
          <span>거래대금 <strong className="text-gray-700">{totalAmount.toLocaleString()}원</strong></span>
        </div>
      )}

      {/* 테이블 */}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : result.data.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p>조건에 맞는 거래 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs">
                <th className="px-4 py-3 text-left font-medium">날짜</th>
                <th className="px-4 py-3 text-left font-medium">종목</th>
                <th className="px-4 py-3 text-center font-medium">구분</th>
                <th className="px-4 py-3 text-right font-medium">수량</th>
                <th className="px-4 py-3 text-right font-medium">단가</th>
                <th className="px-4 py-3 text-right font-medium">총액</th>
                <th className="px-4 py-3 text-center font-medium">감정</th>
                <th className="px-4 py-3 text-left font-medium w-40">메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {result.data.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {new Date(t.tradedAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">{t.stock?.name ?? t.ticker}</span>
                    {t.stock?.name && t.stock.name !== t.ticker && (
                      <span className="ml-1.5 text-xs text-gray-400">{t.ticker}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        t.side === 'BUY' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {t.side === 'BUY' ? '매수' : '매도'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {t.quantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {t.price.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">
                    {(t.quantity * t.price).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {t.emotion ? (
                      <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {EMOTION_LABEL[t.emotion] ?? t.emotion}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 truncate max-w-[160px]">
                    {t.reason ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      {result.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            이전
          </button>

          <div className="flex gap-1">
            {Array.from({ length: Math.min(result.totalPages, 7) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 3, result.totalPages - 6));
              const p = start + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 text-sm rounded-lg ${
                    p === page
                      ? 'bg-gray-800 text-white font-medium'
                      : 'border border-gray-200 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))}
            disabled={page === result.totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            다음
          </button>

          <span className="text-xs text-gray-400 ml-2">
            {page} / {result.totalPages} 페이지
          </span>
        </div>
      )}
    </div>
  );
}
