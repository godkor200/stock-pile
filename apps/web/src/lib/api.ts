const JOURNAL = process.env.NEXT_PUBLIC_JOURNAL_URL ?? 'http://localhost:3001';
const REPORT = process.env.NEXT_PUBLIC_REPORT_URL ?? 'http://localhost:3002';

function getUserId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('sp_user_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('sp_user_id', id);
  }
  return id;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': getUserId(),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

// ── chat ─────────────────────────────────────────────────
export function parseChat(message: string) {
  return request(`${JOURNAL}/chat/parse`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export function clarifyChat(sessionId: string, ticker?: string, fieldUpdates?: object) {
  return request(`${JOURNAL}/chat/clarify`, {
    method: 'POST',
    body: JSON.stringify({ sessionId, ticker, fieldUpdates }),
  });
}

export function confirmChat(sessionId: string) {
  return request(`${JOURNAL}/chat/confirm`, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

// ── trades ────────────────────────────────────────────────
export function getTrades(params?: { ticker?: string; page?: number }) {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return request(`${JOURNAL}/trades${qs ? `?${qs}` : ''}`);
}

// ── positions ─────────────────────────────────────────────
export function getPositions() {
  return request(`${JOURNAL}/positions`);
}

// ── reports ───────────────────────────────────────────────
export function generateReport(ticker: string) {
  return request(`${REPORT}/reports`, {
    method: 'POST',
    body: JSON.stringify({ ticker }),
  });
}

export function getReports(ticker?: string) {
  const qs = ticker ? `?ticker=${ticker}` : '';
  return request(`${REPORT}/reports${qs}`);
}
