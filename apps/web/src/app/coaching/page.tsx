'use client';

import { useEffect, useState } from 'react';
import { getMonthlyCoaching } from '@/lib/api';

interface CoachingStats {
  totalTrades: number;
  buyCount: number;
  sellCount: number;
  topTickers: { ticker: string; name: string; count: number }[];
  emotionDistribution: Record<string, number>;
  reasonRate: number;
  totalRealizedPnl: number;
}

interface CoachingResult {
  summary: string;
  strengths: string[];
  improvements: string[];
  nextMonthTips: string[];
}

interface MonthlyCoaching {
  year: number;
  month: number;
  stats: CoachingStats;
  coaching: CoachingResult;
}

const EMOTION_LABEL: Record<string, string> = {
  PLANNED: '계획',
  IMPULSIVE: '충동',
  NEWS_REACTION: '뉴스반응',
  TECHNICAL: '기술적',
  FOMO: 'FOMO',
};

export default function CoachingPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthlyCoaching | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load(year, month);
  }, []); // eslint-disable-line

  async function load(y: number, m: number) {
    setLoading(true);
    setError('');
    try {
      const res = (await getMonthlyCoaching(y, m)) as MonthlyCoaching;
      setData(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleMonthChange(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setYear(y);
    setMonth(m);
    load(y, m);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">월간 코칭 리포트</h1>

      {/* 월 선택 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => handleMonthChange(-1)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
        >
          ←
        </button>
        <span className="font-medium text-lg">{year}년 {month}월</span>
        <button
          onClick={() => handleMonthChange(1)}
          disabled={year === now.getFullYear() && month === now.getMonth() + 1}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40"
        >
          →
        </button>
      </div>

      {loading && <p className="text-gray-400">분석 중...</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {data && !loading && (
        <div className="space-y-4">
          {/* 통계 요약 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-gray-800 mb-4">이달의 통계</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">{data.stats.totalTrades}</p>
                <p className="text-xs text-gray-400 mt-1">총 매매</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{data.stats.buyCount}</p>
                <p className="text-xs text-gray-400 mt-1">매수</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{data.stats.sellCount}</p>
                <p className="text-xs text-gray-400 mt-1">매도</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm py-2 border-t border-gray-100">
              <span className="text-gray-500">실현 손익</span>
              <span className={`font-medium ${data.stats.totalRealizedPnl >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                {data.stats.totalRealizedPnl >= 0 ? '+' : ''}{data.stats.totalRealizedPnl.toLocaleString()}원
              </span>
            </div>
            <div className="flex items-center justify-between text-sm py-2 border-t border-gray-100">
              <span className="text-gray-500">매매 이유 기록률</span>
              <span className="font-medium">{Math.round(data.stats.reasonRate * 100)}%</span>
            </div>

            {/* 많이 거래한 종목 */}
            {data.stats.topTickers.length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400 mb-2">많이 거래한 종목</p>
                <div className="space-y-1">
                  {data.stats.topTickers.map((t) => (
                    <div key={t.ticker} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{t.name}</span>
                      <span className="text-gray-400">{t.count}건</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 감정 분포 */}
            {Object.keys(data.stats.emotionDistribution).length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400 mb-2">감정 분포</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.stats.emotionDistribution).map(([k, v]) => (
                    <span key={k} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
                      {EMOTION_LABEL[k] ?? k} {v}건
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI 코칭 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-gray-800 mb-3">AI 코칭</h2>
            <p className="text-sm text-gray-600 mb-4">{data.coaching.summary}</p>

            {data.coaching.strengths.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 mb-1.5">잘한 점</p>
                <ul className="space-y-1">
                  {data.coaching.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-green-500 shrink-0">●</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.coaching.improvements.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 mb-1.5">개선할 점</p>
                <ul className="space-y-1">
                  {data.coaching.improvements.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-yellow-500 shrink-0">●</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.coaching.nextMonthTips.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">다음 달 제안</p>
                <ul className="space-y-1">
                  {data.coaching.nextMonthTips.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-blue-400 shrink-0">●</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
