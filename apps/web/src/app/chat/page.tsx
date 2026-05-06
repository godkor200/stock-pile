'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { parseChat, clarifyChat, confirmChat } from '@/lib/api';

type Status = 'READY_TO_CONFIRM' | 'AMBIGUOUS_STOCK' | 'NEEDS_CLARIFICATION' | 'STOCK_NOT_FOUND' | 'CHAT_RESPONSE';

interface ParsedTrade {
  side: string;
  stockQuery: string;
  ticker?: string;
  quantity?: number;
  quantityUnit: string;
  price?: number;
  useMarketPrice: boolean;
  reason?: string;
  confidence: number;
  missingFields: string[];
  clarificationQuestion?: string;
}

interface ChatResponse {
  status: Status;
  parsed?: ParsedTrade;
  sessionId?: string;
  candidates?: { ticker: string; name: string }[];
  prompt?: string;
  message?: string;
  advisedTicker?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  response?: ChatResponse;
  advisedTicker?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '안녕하세요! 매매 기록을 남기거나 투자 질문을 해주세요.\n예) "삼성전자 10주 70000원에 매수" / "지금 삼성전자 사도 돼?"',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function addMessage(msg: Message) {
    setMessages((prev) => [...prev, msg]);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    addMessage({ role: 'user', content: text });
    setLoading(true);

    try {
      let res: ChatResponse;
      if (sessionId) {
        res = (await clarifyChat(sessionId, undefined, { reason: text })) as ChatResponse;
      } else {
        res = (await parseChat(text)) as ChatResponse;
      }
      setSessionId(res.sessionId ?? null);
      handleResponse(res);
    } catch (e) {
      addMessage({ role: 'assistant', content: `오류가 발생했습니다: ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  }

  function handleResponse(res: ChatResponse) {
    if (res.status === 'CHAT_RESPONSE') {
      addMessage({
        role: 'assistant',
        content: res.message ?? '답변을 가져올 수 없습니다.',
        advisedTicker: res.advisedTicker,
      });
      setSessionId(null);
    } else if (res.status === 'STOCK_NOT_FOUND') {
      addMessage({ role: 'assistant', content: res.prompt ?? '종목을 찾을 수 없습니다.' });
      setSessionId(null);
    } else if (res.status === 'AMBIGUOUS_STOCK') {
      addMessage({ role: 'assistant', content: '어떤 종목인가요?', response: res });
    } else if (res.status === 'NEEDS_CLARIFICATION') {
      addMessage({ role: 'assistant', content: res.prompt ?? '추가 정보가 필요합니다.', response: res });
    } else if (res.status === 'READY_TO_CONFIRM') {
      addMessage({ role: 'assistant', content: '확인해주세요.', response: res });
    }
  }

  async function handleSelectStock(ticker: string) {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = (await clarifyChat(sessionId, ticker)) as ChatResponse;
      setSessionId(res.sessionId ?? null);
      handleResponse(res);
    } catch (e) {
      addMessage({ role: 'assistant', content: `오류: ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!sessionId) return;
    setLoading(true);
    try {
      await confirmChat(sessionId);
      addMessage({ role: 'assistant', content: '✅ 매매 기록이 저장되었습니다!' });
      setSessionId(null);
    } catch (e) {
      addMessage({ role: 'assistant', content: `저장 실패: ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <h1 className="text-xl font-semibold mb-4">매매 입력</h1>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-800'
              }`}
            >
              {msg.content}

              {/* 특정 종목 조언 시 종목 분석 탭 안내 */}
              {msg.advisedTicker && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <Link
                    href="/reports"
                    className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
                  >
                    📊 종목 분석 탭에서 재무·뉴스·기술지표 기반의 더 정확한 분석을 확인하세요 →
                  </Link>
                </div>
              )}

              {/* 종목 후보 선택 */}
              {msg.response?.status === 'AMBIGUOUS_STOCK' && msg.response.candidates && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.response.candidates.map((c) => (
                    <button
                      key={c.ticker}
                      onClick={() => handleSelectStock(c.ticker)}
                      className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs hover:bg-blue-100"
                    >
                      {c.name} ({c.ticker})
                    </button>
                  ))}
                </div>
              )}

              {/* 확인 카드 */}
              {msg.response?.status === 'READY_TO_CONFIRM' && msg.response.parsed && (
                <div className="mt-3 bg-gray-50 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">종목</span>
                    <span className="font-medium">
                      {msg.response.parsed.ticker} ({msg.response.parsed.stockQuery})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">구분</span>
                    <span className={msg.response.parsed.side === 'BUY' ? 'text-red-600 font-medium' : 'text-blue-600 font-medium'}>
                      {msg.response.parsed.side === 'BUY' ? '매수' : '매도'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">수량</span>
                    <span className="font-medium">
                      {msg.response.parsed.quantity}
                      {msg.response.parsed.quantityUnit === 'SHARES' ? '주' : '원'}
                    </span>
                  </div>
                  {msg.response.parsed.price && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">단가</span>
                      <span className="font-medium">
                        {msg.response.parsed.price.toLocaleString()}원
                      </span>
                    </div>
                  )}
                  <button
                    onClick={handleConfirm}
                    className="mt-2 w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    저장하기
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-400">
              분석 중...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="예) 삼성전자 10주 70000원에 매수했어"
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
        >
          전송
        </button>
      </div>
    </div>
  );
}
