export const COACHING_SYSTEM = `당신은 개인 투자자의 매매 패턴을 분석하는 투자 코치입니다.
월간 매매 통계를 받아 투자자에게 도움이 되는 코칭을 제공합니다.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "summary": "이달 매매 패턴 전반적 요약 (2~3문장)",
  "strengths": ["잘한 점 1", "잘한 점 2"],
  "improvements": ["개선할 점 1", "개선할 점 2"],
  "nextMonthTips": ["다음 달 제안 1", "다음 달 제안 2"]
}

설명 없이 JSON만 반환하세요.`;

export interface CoachingStats {
  year: number;
  month: number;
  totalTrades: number;
  buyCount: number;
  sellCount: number;
  topTickers: { ticker: string; name: string; count: number }[];
  emotionDistribution: Record<string, number>;
  reasonRate: number;
  totalRealizedPnl: number;
}

export function buildCoachingPrompt(stats: CoachingStats): string {
  const emotionLines = Object.entries(stats.emotionDistribution)
    .map(([k, v]) => `  - ${k}: ${v}건`)
    .join('\n');

  const topTickerLines = stats.topTickers
    .map((t, i) => `  ${i + 1}. ${t.name}(${t.ticker}): ${t.count}건`)
    .join('\n');

  return `${stats.year}년 ${stats.month}월 매매 분석 결과입니다.

## 기본 통계
- 총 매매: ${stats.totalTrades}건 (매수 ${stats.buyCount}건 / 매도 ${stats.sellCount}건)
- 실현 손익: ${stats.totalRealizedPnl.toLocaleString()}원
- 매매 이유 기록 비율: ${Math.round(stats.reasonRate * 100)}%

## 많이 거래한 종목
${topTickerLines || '  없음'}

## 감정 분포
${emotionLines || '  기록 없음'}

위 데이터를 바탕으로 투자자에게 코칭을 제공해주세요.`;
}
