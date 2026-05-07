'use client';

import { useEffect, useState } from 'react';
import { generateReport, getReports } from '@/lib/api';

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
  const [ticker, setTicker] = useState('');
  const [selected, setSelected] = useState<Report | null>(null);
  const [error, setError] = useState('');

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
    try {
      const report = (await generateReport(t)) as Report;
      setReports((prev) => [report, ...prev.filter((r) => r.ticker !== t)]);
      setSelected(report);
      setTicker('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
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
            <p className="mt-4 text-xs text-gray-400">
              {new Date(selected.generatedAt).toLocaleString('ko-KR')} 생성
            </p>
          </div>
        );
      })()}

      {/* 리포트 목록 */}
      {loading ? (
        <p className="text-gray-400">불러오는 중...</p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
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
