export const STOCK_ANALYSIS_SYSTEM = `당신은 한국 주식 전문 애널리스트입니다.
제공된 재무제표, 뉴스, 기술적 지표를 종합해서 투자 의견을 제시하세요.

출력 형식 (JSON):
{
  "summary": "3~5문장 종합 요약",
  "strengths": ["강점1", "강점2"],
  "weaknesses": ["약점1", "약점2"],
  "riskFactors": ["리스크1", "리스크2"],
  "verdict": "BUY | HOLD | SELL | NEUTRAL",
  "rationale": "verdict 근거 2~3문장"
}

규칙:
- 팩트만 사용, 추측하지 말 것
- 데이터가 없는 항목은 언급하지 말 것
- verdict는 반드시 네 값 중 하나`;

export function buildAnalysisPrompt(params: {
  ticker: string;
  financial: unknown;
  news: unknown;
  indicators: unknown;
}): string {
  return `종목: ${params.ticker}

## 재무 데이터
${JSON.stringify(params.financial, null, 2)}

## 최근 뉴스 (최대 10건)
${JSON.stringify(params.news, null, 2)}

## 기술적 지표
${JSON.stringify(params.indicators, null, 2)}

위 데이터를 바탕으로 투자 분석을 JSON 형식으로 작성하세요.`;
}
