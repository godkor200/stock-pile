export interface StockAnalysis {
  ticker: string;
  verdict: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  riskFactors: string[];
  rationale: string;
}

export interface PortfolioContext {
  positions: {
    ticker: string;
    stockName: string;
    quantity: number;
    avgPrice: number;
    realizedPnl: number;
    currentPrice: number | null;
  }[];
  recentTrades: {
    ticker: string;
    stockName: string;
    side: string;
    quantity: number;
    price: number;
    tradedAt: string;
    reason?: string | null;
    emotion?: string | null;
  }[];
}

export interface QueriedStock {
  ticker: string;
  name: string;
  currentPrice: number | null;
}

export function buildAdvisorSystemPrompt(
  ctx: PortfolioContext,
  analysis?: StockAnalysis | null,
  queriedStock?: QueriedStock | null,
): string {
  const positionText =
    ctx.positions.length > 0
      ? ctx.positions
          .map((p) => {
            const avgPrice = Number(p.avgPrice);
            const qty = Number(p.quantity);
            const label = p.stockName !== p.ticker ? `${p.stockName}(${p.ticker})` : p.ticker;
            let line = `- ${label}: ${qty}주, 평균단가 ${avgPrice.toLocaleString('ko-KR')}원`;

            if (p.currentPrice !== null) {
              const unrealizedPnl = (p.currentPrice - avgPrice) * qty;
              const unrealizedPct = ((p.currentPrice - avgPrice) / avgPrice) * 100;
              line +=
                `, 현재가 ${p.currentPrice.toLocaleString('ko-KR')}원` +
                ` (미실현손익 ${unrealizedPnl >= 0 ? '+' : ''}${Math.round(unrealizedPnl).toLocaleString('ko-KR')}원` +
                ` / ${unrealizedPct >= 0 ? '+' : ''}${unrealizedPct.toFixed(1)}%)`;
            } else {
              line += `, 현재가 조회 불가`;
            }

            if (Number(p.realizedPnl) !== 0) {
              line += `, 실현손익 ${Number(p.realizedPnl).toLocaleString('ko-KR')}원`;
            }
            return line;
          })
          .join('\n')
      : '보유 포지션 없음';

  const tradeText =
    ctx.recentTrades.length > 0
      ? ctx.recentTrades
          .map((t) => {
            const label = t.stockName !== t.ticker ? `${t.stockName}(${t.ticker})` : t.ticker;
            return (
              `- ${t.tradedAt.slice(0, 10)} ${label} ${t.side === 'BUY' ? '매수' : '매도'} ` +
              `${t.quantity}주 @${Number(t.price).toLocaleString('ko-KR')}원` +
              (t.reason ? ` (사유: ${t.reason})` : '') +
              (t.emotion ? ` [${t.emotion}]` : '')
            );
          })
          .join('\n')
      : '최근 거래 없음';

  const analysisText = analysis
    ? `\n종목 분석 리포트 (${analysis.ticker}):
판정: ${analysis.verdict}
요약: ${analysis.summary}
강점: ${analysis.strengths.join(' / ')}
약점: ${analysis.weaknesses.join(' / ')}
리스크: ${analysis.riskFactors.join(' / ')}
근거: ${analysis.rationale}\n`
    : '';

  const queriedStockText = queriedStock
    ? `\n[사용자가 조회한 종목]
종목: ${queriedStock.name}(${queriedStock.ticker})
현재 시장가: ${queriedStock.currentPrice !== null ? `${queriedStock.currentPrice.toLocaleString('ko-KR')}원` : '조회 실패'}\n`
    : '';

  return `당신은 개인 투자 코치입니다. 사용자의 포트폴리오 데이터를 바탕으로 질문에 솔직하고 구체적으로 답합니다.

현재 보유 포지션:
${positionText}

최근 매매 이력 (최근 10건):
${tradeText}
${queriedStockText}${analysisText}
[중요 규칙]
- 종목명과 티커를 절대 혼동하지 않는다. 위 데이터의 종목명(티커)을 그대로 사용한다.
- 위 포트폴리오에 없는 종목은 보유 중이라고 말하지 않는다. 단, 조언은 반드시 제공한다.
- [사용자가 조회한 종목] 섹션이 있으면 그 종목의 현재 시장가를 첫 문장에서 직접 답한다.
- 미보유 종목 질문 시: 가격 정보를 먼저 알려준 뒤 간략한 투자 관점을 덧붙인다.
- 보유 종목 질문 시: 평균단가, 현재가, 손익률 등 실제 데이터를 활용해 구체적으로 답한다.
- 한국어로 답변, 400자 이내로 간결하게
- 투자 결정은 본인 책임임을 마지막에 한 줄로 명시`;
}
