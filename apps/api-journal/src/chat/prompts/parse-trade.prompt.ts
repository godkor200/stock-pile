export const PARSE_TRADE_SYSTEM = `당신은 주식 매매 기록 파싱 전문가입니다.
사용자의 자연어 메시지에서 매매 정보를 추출해 parse_trade 도구를 호출하세요.

규칙:
- 매수/매도가 명확하지 않으면 side를 null로 두세요
- 수량 단위: "주", "만원", "원" 등으로 구분 (단위 없으면 SHARES 가정)
- 종목은 이름 또는 티커 그대로 stockQuery에 넣으세요
- 가격이 없으면 useMarketPrice: true
- confidence: 0~1 (정보가 충분할수록 높게)
- 빠진 핵심 정보(side, stockQuery, quantity)는 missingFields에 나열하세요
- clarificationQuestion: 빠진 정보를 묻는 한 문장`;

export const parseTradeTool = {
  name: 'parse_trade',
  description: '사용자 메시지에서 매매 정보를 구조화해서 추출',
  input_schema: {
    type: 'object' as const,
    properties: {
      side: {
        type: 'string',
        enum: ['BUY', 'SELL'],
        description: '매수 또는 매도',
      },
      stockQuery: {
        type: 'string',
        description: '종목명 또는 티커 (사용자가 입력한 그대로)',
      },
      ticker: {
        type: 'string',
        description: '티커가 명확하면 대문자로',
      },
      quantity: {
        type: 'number',
        description: '수량 (주 또는 금액)',
      },
      quantityUnit: {
        type: 'string',
        enum: ['SHARES', 'AMOUNT'],
        description: 'SHARES=주, AMOUNT=금액(원)',
      },
      price: {
        type: 'number',
        description: '단가 (원)',
      },
      useMarketPrice: {
        type: 'boolean',
        description: '시장가 사용 여부',
      },
      reason: {
        type: 'string',
        description: '매매 이유 (있으면)',
      },
      emotion: {
        type: 'string',
        enum: ['PLANNED', 'IMPULSIVE', 'NEWS_REACTION', 'TECHNICAL', 'FOMO'],
        description: '감정 상태',
      },
      confidence: {
        type: 'number',
        description: '파싱 신뢰도 0~1',
      },
      missingFields: {
        type: 'array',
        items: { type: 'string' },
        description: '빠진 필드 목록',
      },
      clarificationQuestion: {
        type: 'string',
        description: '추가로 물어볼 내용',
      },
    },
    required: ['stockQuery', 'quantityUnit', 'useMarketPrice', 'confidence', 'missingFields'],
  },
};
