'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface BacktestMetrics {
  total_return_pct: number;
  annual_return_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  total_trades: number;
  win_rate_pct: number;
  initial_capital: number;
  final_value: number;
}

interface BacktestResult {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  ticker?: string;
  strategy_name?: string;
  metrics?: BacktestMetrics;
  equity_curve?: { date: string; value: number }[];
  error?: string;
}

interface TradeRecord {
  entry_date: string;
  exit_date: string;
  size: number;
  entry_price: number;
  exit_price: number;
  pnl: number;
  return_pct: number;
}

const POLLING_INTERVAL_MS = 2000;

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${color ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function pct(v: number, decimals = 2) {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(decimals)}%`;
}

function won(v: number) {
  return `${Math.round(v).toLocaleString()}원`;
}

export default function BacktestPage() {
  const [naturalLanguage, setNaturalLanguage] = useState('');
  const [ticker, setTicker] = useState('');
  const [startDate, setStartDate] = useState('2022-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [initialCapital, setInitialCapital] = useState('10000000');
  const [showTradesTable, setShowTradesTable] = useState(false);

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [error, setError] = useState('');

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  useEffect(() => () => stopPolling(), []);

  async function pollResult(resultId: string) {
    try {
      const res = await fetch(`/api/backtest/backtest/results/${resultId}`);
      if (!res.ok) return;
      const data: BacktestResult = await res.json();
      setResult(data);

      if (data.status === 'DONE') {
        stopPolling();
        setRunning(false);
        // 거래 로그 로드
        const tRes = await fetch(`/api/backtest/backtest/results/${resultId}/trades`);
        if (tRes.ok) setTrades(await tRes.json());
      } else if (data.status === 'FAILED') {
        stopPolling();
        setRunning(false);
        setError(data.error ?? '백테스트에 실패했습니다.');
      }
    } catch {
      // 네트워크 오류는 무시하고 계속 폴링
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!naturalLanguage.trim() || !ticker.trim()) return;

    stopPolling();
    setRunning(true);
    setResult(null);
    setTrades([]);
    setError('');
    setShowTradesTable(false);

    try {
      const res = await fetch('/api/backtest/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: ticker.trim(),
          start_date: startDate,
          end_date: endDate,
          initial_capital: Number(initialCapital),
          natural_language: naturalLanguage.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `서버 오류 (${res.status})`);
      }

      const { id } = await res.json();
      setResult({ id, status: 'PENDING' });

      pollTimer.current = setInterval(() => pollResult(id), POLLING_INTERVAL_MS);
    } catch (err) {
      setError((err as Error).message);
      setRunning(false);
    }
  }

  const statusLabel: Record<string, string> = {
    PENDING: '대기 중...',
    RUNNING: '백테스트 실행 중...',
    DONE: '완료',
    FAILED: '실패',
  };

  const m = result?.metrics;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">백테스트</h1>

      {/* 입력 폼 */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-xl p-5 space-y-4"
      >
        <div>
          <label className="block text-xs text-gray-500 mb-1">전략 설명 (자연어)</label>
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
            rows={3}
            placeholder="예) 5일선이 20일선을 상향돌파하면 매수하고, 5% 수익이나 3% 손실에 매도해. 한 번에 100만원씩."
            value={naturalLanguage}
            onChange={(e) => setNaturalLanguage(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              종목 코드
              <span className="ml-1 text-gray-400">(예: 005930.KS, AAPL)</span>
            </label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
              placeholder="005930.KS"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">초기 자본 (원)</label>
            <input
              type="number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
              value={initialCapital}
              onChange={(e) => setInitialCapital(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">시작일</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">종료일</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={running || !naturalLanguage.trim() || !ticker.trim()}
          className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {running ? '실행 중...' : '백테스트 실행'}
        </button>
      </form>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 상태 표시 */}
      {result && result.status !== 'DONE' && (
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-4 flex items-center gap-3">
          {(result.status === 'PENDING' || result.status === 'RUNNING') && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
          <span className="text-sm text-gray-600">
            {statusLabel[result.status] ?? result.status}
          </span>
        </div>
      )}

      {/* 결과 */}
      {result?.status === 'DONE' && m && (
        <div className="space-y-4">
          {/* 전략 정보 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">{result.strategy_name}</span>
            <span className="text-xs text-gray-400">{result.ticker}</span>
            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full">완료</span>
          </div>

          {/* 성과 지표 카드 */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="총 수익률"
              value={pct(m.total_return_pct)}
              color={m.total_return_pct >= 0 ? 'text-green-600' : 'text-red-500'}
            />
            <MetricCard
              label="연간 수익률"
              value={pct(m.annual_return_pct)}
              color={m.annual_return_pct >= 0 ? 'text-green-600' : 'text-red-500'}
            />
            <MetricCard
              label="Sharpe 비율"
              value={m.sharpe_ratio.toFixed(3)}
              color={m.sharpe_ratio >= 1 ? 'text-green-600' : m.sharpe_ratio >= 0 ? 'text-gray-700' : 'text-red-500'}
            />
            <MetricCard
              label="최대 낙폭 (MDD)"
              value={pct(m.max_drawdown_pct)}
              color="text-red-500"
            />
            <MetricCard label="거래 횟수" value={`${m.total_trades}회`} />
            <MetricCard label="승률" value={`${m.win_rate_pct.toFixed(1)}%`} />
          </div>

          {/* 최종 금액 요약 */}
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {won(m.initial_capital)} → <span className="font-medium text-gray-800">{won(m.final_value)}</span>
            </span>
            <span className={`text-sm font-semibold ${m.final_value >= m.initial_capital ? 'text-green-600' : 'text-red-500'}`}>
              {won(m.final_value - m.initial_capital)} ({pct(m.total_return_pct)})
            </span>
          </div>

          {/* 에쿼티 커브 */}
          {result.equity_curve && result.equity_curve.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">에쿼티 커브</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={result.equity_curve} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={(d: string) => d.slice(2, 7).replace('-', '/')}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={(v: number) => `${Math.round(v / 10_000)}만`}
                    width={52}
                  />
                  <Tooltip
                    formatter={(v: number) => [won(v), '평가액']}
                    labelStyle={{ fontSize: 12 }}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3B82F6"
                    dot={false}
                    strokeWidth={1.5}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 거래 내역 토글 */}
          {trades.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowTradesTable((v) => !v)}
                className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <span>거래 내역 ({trades.length}건)</span>
                <span className="text-gray-400">{showTradesTable ? '▲' : '▼'}</span>
              </button>
              {showTradesTable && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">진입일</th>
                        <th className="px-3 py-2 text-left">청산일</th>
                        <th className="px-3 py-2 text-right">진입가</th>
                        <th className="px-3 py-2 text-right">청산가</th>
                        <th className="px-3 py-2 text-right">손익</th>
                        <th className="px-3 py-2 text-right">수익률</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {trades.map((t, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-600">{t.entry_date}</td>
                          <td className="px-3 py-2 text-gray-600">{t.exit_date}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{t.entry_price.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{t.exit_price.toLocaleString()}</td>
                          <td className={`px-3 py-2 text-right font-medium ${t.pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {t.pnl >= 0 ? '+' : ''}{Math.round(t.pnl).toLocaleString()}
                          </td>
                          <td className={`px-3 py-2 text-right font-medium ${t.return_pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {pct(t.return_pct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
