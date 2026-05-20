'use client';

import { useEffect, useRef, useState } from 'react';
import { generateReport, getReports, getReportHistory } from '@/lib/api';

interface ReportAnalysis {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  riskFactors: string[];
  verdict: string;
  rationale: string;
}

interface Report {
  id: string;
  ticker: string;
  generatedAt: string;
  verdict: string;
  claudeAnalysis: string;
  stock?: { name: string };
}

const VERDICT_STYLE: Record<string, string> = {
  BUY: 'bg-red-50 text-red-600',
  SELL: 'bg-blue-50 text-blue-600',
  HOLD: 'bg-yellow-50 text-yellow-700',
  NEUTRAL: 'bg-gray-100 text-gray-600',
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ticker, setTicker] = useState('');
  const [selected, setSelected] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Report[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function startProgress() {
    setProgress(0);
    const step = 90 / (30 * 10);
    progressTimer.current = setInterval(() => {
      setProgress((p) => Math.min(p + step, 90));
    }, 100);
  }

  function finishProgress() {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 600);
  }

  useEffect(() => {
    getReports()
      .then((res) => setReports(res as Report[]))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setGenerating(true);
    setError('');
    startProgress();
    try {
      const report = (await generateReport(t)) as Report;
      setReports((prev) => [report, ...prev.filter((r) => r.ticker !== t)]);
      setSelected(report);
      setTicker('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      finishProgress();
      setGenerating(false);
    }
  }

  function parseAnalysis(raw: string): ReportAnalysis | null {
    try {
      return JSON.parse(raw) as ReportAnalysis;
    } catch {
      return null;
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">종목 분석</h1>

      {/* 리포트 생성 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-gray-500 mb-3">티커 또는 종목명을 입력하면 재무·뉴스·기술지표를 분석합니다.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="005930"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleGenerate}
            disabled={generating || !ticker.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
          >
            {generating ? '분석 중...' : '분석하기'}
          </button>
        </div>
        {generating && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">DART·뉴스·지표 수집 후 AI 분석 중...</span>
              <span className="text-xs text-gray-400">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 bg-blue-500 rounded-full transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
      </div>

      {/* 리포트 상세 */}
      {selected && (() => {
        const analysis = parseAnalysis(selected.claudeAnalysis);
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">{selected.stock?.name ?? selected.ticker}</h2>
                {selected.stock?.name && selected.stock.name !== selected.ticker && (
                  <p className="text-xs text-gray-400">{selected.ticker}</p>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${VERDICT_STYLE[selected.verdict] ?? ''}`}>
                {selected.verdict}
              </span>
            </div>
            {analysis ? (
              <div className="space-y-4 text-sm">
                <p className="text-gray-700">{analysis.summary}</p>
                {analysis.strengths.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-900 mb-1">강점</p>
                    <ul className="space-y-1">
                      {analysis.strengths.map((s, i) => (
                        <li key={i} className="text-gray-600 flex gap-2"><span className="text-green-500">●</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.weaknesses.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-900 mb-1">약점</p>
                    <ul className="space-y-1">
                      {analysis.weaknesses.map((s, i) => (
                        <li key={i} className="text-gray-600 flex gap-2"><span className="text-red-400">●</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.riskFactors.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-900 mb-1">리스크</p>
                    <ul className="space-y-1">
                      {analysis.riskFactors.map((s, i) => (
                        <li key={i} className="text-gray-600 flex gap-2"><span className="text-yellow-500">●</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-gray-500 text-xs">{analysis.rationale}</p>
              </div>
            ) : (
              <p className="text-gray-600 text-sm">{selected.claudeAnalysis}</p>
            )}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {new Date(selected.generatedAt).toLocaleString('ko-KR')} 생성
              </p>
              <button
                onClick={async () => {
                  if (!showHistory) {
                    const h = (await getReportHistory(selected.ticker)) as Report[];
                    setHistory(h);
                  }
                  setShowHistory((v) => !v);
                }}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                {showHistory ? '이력 닫기' : '분석 이력 보기'}
              </button>
            </div>

            {showHistory && history.length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
                <p className="text-xs font-medium text-gray-500 mb-2">분석 이력</p>
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50">
                    <span className="text-gray-500">{new Date(h.generatedAt).toLocaleString('ko-KR')}</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${VERDICT_STYLE[h.verdict] ?? ''}`}>
                        {h.verdict}
                      </span>
                      <button
                        onClick={() => { setSelected(h); setShowHistory(false); }}
                        className="text-gray-400 hover:text-blue-500"
                      >
                        보기
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* 리포트 목록 */}
      {loading ? (
        <p className="text-gray-400">불러오는 중...</p>
      ) : (
        <div className="space-y-2">
          {reports.filter((r) => r.id !== selected?.id).length > 0 && (
            <p className="text-xs text-gray-400 font-medium px-1 mb-1">이전에 분석한 종목</p>
          )}
          {reports.filter((r) => r.id !== selected?.id).map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{r.stock?.name ?? r.ticker}</span>
                  {r.stock?.name && r.stock.name !== r.ticker && (
                    <span className="ml-2 text-xs text-gray-400">{r.ticker}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${VERDICT_STYLE[r.verdict] ?? ''}`}>
                    {r.verdict}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(r.generatedAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
