import Link from 'next/link';

const TECH_STACK = [
  { label: 'NestJS', color: 'bg-red-50 text-red-600 border-red-200' },
  { label: 'Next.js 14', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { label: 'Python FastAPI', color: 'bg-green-50 text-green-700 border-green-200' },
  { label: 'TypeScript', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { label: 'PostgreSQL + pgvector', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { label: 'Redis', color: 'bg-red-50 text-red-500 border-red-200' },
  { label: 'Claude AI', color: 'bg-purple-50 text-purple-600 border-purple-200' },
  { label: 'Groq API', color: 'bg-orange-50 text-orange-600 border-orange-200' },
  { label: 'TypeORM', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { label: 'Turborepo', color: 'bg-gray-100 text-gray-600 border-gray-300' },
  { label: 'Docker', color: 'bg-blue-50 text-blue-500 border-blue-200' },
  { label: 'vectorbt', color: 'bg-green-50 text-green-600 border-green-200' },
];

const FEATURES_DONE = [
  { emoji: '💬', title: '자연어 매매 기록', desc: 'Groq LLM으로 "삼성전자 10주 매수" → 자동 파싱 저장' },
  { emoji: '📊', title: '종목 분석 리포트', desc: 'DART 공시 + 뉴스 + 기술 지표 → Claude AI 종합 분석' },
  { emoji: '🧠', title: '월간 코칭', desc: '매매 패턴 AI 분석 — 감정별 승률, 개선 제안' },
  { emoji: '📁', title: 'CSV 일괄 입력', desc: '주요 증권사 거래내역 CSV 파싱 + 중복 감지' },
  { emoji: '📈', title: '포지션 관리', desc: '보유 종목 평균 단가 자동 집계 (매수/매도 트랜잭션)' },
  { emoji: '🔐', title: '인증', desc: '이메일 회원가입/로그인 (crypto 내장)' },
  { emoji: '🌐', title: '운영 배포', desc: 'Oracle Cloud VM.Standard.A1.Flex + Coolify (ARM64)' },
];

const FEATURES_WIP = [
  { title: '백테스트 엔진', desc: '자연어 전략 → DSL → vectorbt 시뮬레이션', tag: 'T-26' },
  { title: '포지션 미실현 손익', desc: '현재가 기반 수익률 실시간 표시', tag: 'T-28' },
  { title: '대시보드 실질화', desc: '오늘 수익률 / 월간 통계 / 최근 매매', tag: 'T-29' },
];

const SERVICES = [
  { name: 'api-journal', port: '3001', desc: '매매 CRUD · 포지션 · 챗봇 파싱 · 코칭', tech: 'NestJS' },
  { name: 'api-report', port: '3002', desc: '종목 분석 합성 (DART + 뉴스 + 지표)', tech: 'NestJS' },
  { name: 'api-backtest', port: '3003', desc: '전략 DSL + vectorbt 엔진', tech: 'FastAPI' },
  { name: 'web', port: '3005', desc: 'Next.js 14 App Router 프론트엔드', tech: 'Next.js' },
];

export default function AboutPage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Stock Pile</h1>
            <p className="text-gray-500 text-sm leading-relaxed max-w-lg">
              자연어 챗봇으로 매매를 기록하고, AI가 종목을 분석하며, 투자 패턴을 코칭하는
              <br />개인 투자 어시스턴트 풀스택 사이드 프로젝트
            </p>
          </div>
          <a
            href="https://github.com/godkor200/stock-pile"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">기술 스택</h2>
        <div className="flex flex-wrap gap-2">
          {TECH_STACK.map((t) => (
            <span
              key={t.label}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${t.color}`}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* Architecture */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">서비스 아키텍처</h2>
        <div className="grid grid-cols-2 gap-3">
          {SERVICES.map((s) => (
            <div key={s.name} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm font-medium text-gray-800">{s.name}</span>
                <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">:{s.port}</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">{s.desc}</p>
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{s.tech}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 font-mono">
          pnpm + Turborepo 모노레포 · PostgreSQL + pgvector · Redis · Oracle Cloud (ARM64) + Coolify
        </div>
      </div>

      {/* Implemented Features */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">구현된 기능</h2>
        <div className="space-y-3">
          {FEATURES_DONE.map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <span className="text-lg shrink-0">{f.emoji}</span>
              <div>
                <p className="text-sm font-medium text-gray-800">{f.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
              </div>
              <span className="ml-auto text-green-500 text-sm shrink-0">✓</span>
            </div>
          ))}
        </div>
      </div>

      {/* In Progress */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">개발 중</h2>
        <div className="space-y-3">
          {FEATURES_WIP.map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <span className="text-gray-300 text-sm shrink-0 mt-0.5">○</span>
              <div>
                <p className="text-sm font-medium text-gray-700">{f.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
              </div>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">{f.tag}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400 pb-4">
        <Link href="/auth" className="hover:text-blue-600 transition-colors">앱 사용해보기 →</Link>
      </div>
    </div>
  );
}
