'use client';

import { useEffect, useMemo, useState } from 'react';
import { getDailyStats, DailyStat } from '@/lib/api';

// ── 상수 ────────────────────────────────────────────────────────────────────
const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// ── 색상 ────────────────────────────────────────────────────────────────────
function getColor(pnl: number, tradeCount: number): string {
  if (tradeCount === 0) return '#ebedf0';
  if (pnl === 0) return '#bfdbfe'; // 매수만 있는 날 (파란색)
  if (pnl >= 5_000_000) return '#14532d';
  if (pnl >= 1_000_000) return '#16a34a';
  if (pnl >= 100_000) return '#4ade80';
  if (pnl > 0) return '#bbf7d0';
  if (pnl <= -5_000_000) return '#7f1d1d';
  if (pnl <= -1_000_000) return '#dc2626';
  if (pnl <= -100_000) return '#f87171';
  return '#fecaca';
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? '+' : '';
  return `${sign}${Math.round(pnl).toLocaleString()}원`;
}

// ── 캘린더 그리드 빌더 ───────────────────────────────────────────────────────
interface DayCell {
  date: string;
  inYear: boolean;
  pnl: number;
  tradeCount: number;
}

function buildGrid(year: number, statsMap: Map<string, DailyStat>): DayCell[][] {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);

  // 그리드 시작: Jan 1이 속한 주의 일요일
  const start = new Date(jan1);
  start.setDate(jan1.getDate() - jan1.getDay());

  // 그리드 끝: Dec 31이 속한 주의 토요일
  const end = new Date(dec31);
  end.setDate(dec31.getDate() + (6 - dec31.getDay()));

  const weeks: DayCell[][] = [];
  const cur = new Date(start);

  while (cur <= end) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = cur.toISOString().slice(0, 10);
      const inYear = cur.getFullYear() === year;
      const stat = statsMap.get(iso);
      week.push({
        date: iso,
        inYear,
        pnl: stat?.pnl ?? 0,
        tradeCount: inYear ? (stat?.tradeCount ?? 0) : 0,
      });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

// 각 주의 첫 날 기준으로 월 레이블 위치 계산
function getMonthPositions(weeks: DayCell[][]): { label: string; col: number }[] {
  const positions: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, colIdx) => {
    const firstInYear = week.find((c) => c.inYear);
    if (!firstInYear) return;
    const month = new Date(firstInYear.date).getMonth();
    if (month !== lastMonth) {
      positions.push({ label: MONTH_LABELS[month], col: colIdx });
      lastMonth = month;
    }
  });
  return positions;
}

// ── 컴포넌트 ────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    getDailyStats(year)
      .then(setStats)
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, [year]);

  const statsMap = useMemo(
    () => new Map(stats.map((s) => [s.date, s])),
    [stats],
  );

  const weeks = useMemo(() => buildGrid(year, statsMap), [year, statsMap]);
  const monthPositions = useMemo(() => getMonthPositions(weeks), [weeks]);

  const totalPnl = stats.reduce((s, d) => s + d.pnl, 0);
  const tradingDays = stats.filter((d) => d.tradeCount > 0).length;
  const profitDays = stats.filter((d) => d.pnl > 0).length;

  const CELL = 13; // px
  const GAP = 2;   // px
  const CELL_STEP = CELL + GAP;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">수익 캘린더</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          >
            ‹
          </button>
          <span className="text-sm font-medium w-12 text-center">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= currentYear}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">연간 실현 손익</p>
            <p className={`text-lg font-semibold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {formatPnl(totalPnl)}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">매매 일수</p>
            <p className="text-lg font-semibold text-gray-900">{tradingDays}일</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">수익 일수</p>
            <p className="text-lg font-semibold text-gray-900">
              {profitDays}일
              {tradingDays > 0 && (
                <span className="text-sm text-gray-400 font-normal ml-1">
                  ({Math.round((profitDays / tradingDays) * 100)}%)
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* 히트맵 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 overflow-x-auto">
        {loading ? (
          <div className="text-sm text-gray-400 text-center py-8">불러오는 중...</div>
        ) : (
          <div
            className="relative"
            onMouseLeave={() => setTooltip(null)}
          >
            {/* 월 레이블 */}
            <div
              className="relative mb-1"
              style={{ height: 16, marginLeft: 28 }}
            >
              {monthPositions.map(({ label, col }) => (
                <span
                  key={label}
                  className="absolute text-xs text-gray-400"
                  style={{ left: col * CELL_STEP }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* 요일 레이블 + 그리드 */}
            <div className="flex gap-0">
              {/* 요일 레이블 */}
              <div
                className="flex flex-col shrink-0"
                style={{ gap: GAP, marginRight: GAP, width: 20 }}
              >
                {DAY_LABELS.map((d) => (
                  <div
                    key={d}
                    className="text-xs text-gray-400 flex items-center justify-end"
                    style={{ height: CELL }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* 주(column) × 요일(row) 그리드 */}
              <div className="flex" style={{ gap: GAP }}>
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
                    {week.map((cell, di) => (
                      <div
                        key={di}
                        style={{
                          width: CELL,
                          height: CELL,
                          borderRadius: 2,
                          backgroundColor: cell.inYear
                            ? getColor(cell.pnl, cell.tradeCount)
                            : 'transparent',
                          cursor: cell.inYear && cell.tradeCount > 0 ? 'pointer' : 'default',
                        }}
                        onMouseEnter={(e) => {
                          if (!cell.inYear) return;
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          const containerRect = (e.currentTarget.closest('.relative') as HTMLElement)
                            .getBoundingClientRect();
                          setTooltip({
                            text:
                              cell.tradeCount === 0
                                ? `${cell.date} — 매매 없음`
                                : `${cell.date}\n${cell.tradeCount}건 | ${formatPnl(cell.pnl)}`,
                            x: rect.left - containerRect.left + CELL / 2,
                            y: rect.top - containerRect.top - 6,
                          });
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* 툴팁 */}
            {tooltip && (
              <div
                className="absolute z-10 bg-gray-800 text-white text-xs rounded px-2 py-1 pointer-events-none whitespace-pre"
                style={{
                  left: tooltip.x,
                  top: tooltip.y,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                {tooltip.text}
              </div>
            )}
          </div>
        )}

        {/* 범례 */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
          <span className="text-xs text-gray-400">적음</span>
          {[
            { color: '#bbf7d0', label: '소폭 이익' },
            { color: '#4ade80', label: '이익' },
            { color: '#16a34a', label: '큰 이익' },
            { color: '#14532d', label: '최대 이익' },
          ].map(({ color, label }) => (
            <div key={color} className="flex items-center gap-1">
              <div style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: color }} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
          <span className="text-gray-200 mx-1">|</span>
          {[
            { color: '#fecaca', label: '소폭 손실' },
            { color: '#f87171', label: '손실' },
            { color: '#dc2626', label: '큰 손실' },
          ].map(({ color, label }) => (
            <div key={color} className="flex items-center gap-1">
              <div style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: color }} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 ml-1">
            <div style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: '#bfdbfe' }} />
            <span className="text-xs text-gray-400">매수만</span>
          </div>
        </div>
      </div>
    </div>
  );
}
