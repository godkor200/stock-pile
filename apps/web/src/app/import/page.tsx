'use client';

import { useRef, useState } from 'react';
import { importCsv, getCsvTemplate } from '@/lib/api';

interface ImportResult {
  imported: number;
  errors: string[];
}

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);
    setError('');

    try {
      const res = await importCsv(file);
      setResult(res as ImportResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">CSV 일괄 입력</h1>
      <p className="text-sm text-gray-500 mb-6">
        엑셀/CSV 파일로 과거 매매 내역을 한 번에 가져옵니다.
      </p>

      {/* 템플릿 다운로드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-blue-800 mb-1">CSV 형식</p>
        <code className="text-xs text-blue-700 block mb-3">
          ticker, side, quantity, price, tradedAt, reason(선택), emotion(선택)
        </code>
        <div className="text-xs text-blue-600 space-y-1 mb-3">
          <p>• <strong>side</strong>: 매수 / 매도 / BUY / SELL</p>
          <p>• <strong>tradedAt</strong>: 2024-01-15 형식</p>
          <p>• <strong>emotion</strong>: PLANNED / IMPULSIVE / NEWS_REACTION / TECHNICAL / FOMO</p>
        </div>
        <button
          onClick={getCsvTemplate}
          className="text-xs text-blue-700 underline hover:text-blue-900"
        >
          템플릿 다운로드
        </button>
      </div>

      {/* 파일 업로드 */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
      >
        <p className="text-gray-500 text-sm">
          {loading ? '업로드 중...' : 'CSV 파일을 클릭해서 선택하세요'}
        </p>
        <p className="text-xs text-gray-400 mt-1">최대 5MB · UTF-8 또는 EUC-KR</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleUpload}
          disabled={loading}
        />
      </div>

      {/* 결과 */}
      {result && (
        <div className="mt-6 space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-green-800 font-medium">
              {result.imported}건 저장 완료
            </p>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-yellow-800 font-medium mb-2">
                {result.errors.length}행 건너뜀
              </p>
              <ul className="text-xs text-yellow-700 space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
