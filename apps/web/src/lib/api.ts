const JOURNAL = '/api/journal';
const REPORT = '/api/report';

export function getUserId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('sp_user_id') ?? '';
}

export function isLoggedIn(): boolean {
  return !!getUserId();
}

export function logout(): void {
  localStorage.removeItem('sp_user_id');
  localStorage.removeItem('sp_token');
  window.location.href = '/auth';
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

// ── auth ──────────────────────────────────────────────────
export async function signup(email: string, password: string): Promise<void> {
  const res = await fetch(`${JOURNAL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { message?: string };
    throw new Error(body.message ?? res.statusText);
  }
  const { userId, token } = (await res.json()) as { userId: string; token: string };
  localStorage.setItem('sp_user_id', userId);
  localStorage.setItem('sp_token', token);
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${JOURNAL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = (await res.json()) as { message?: string };
    throw new Error(body.message ?? res.statusText);
  }
  const { userId, token } = (await res.json()) as { userId: string; token: string };
  localStorage.setItem('sp_user_id', userId);
  localStorage.setItem('sp_token', token);
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
export interface TradeFilter {
  ticker?: string;
  side?: 'BUY' | 'SELL';
  from?: string;
  to?: string;
  sort?: string;
  order?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export function getTrades(params?: TradeFilter) {
  const clean = Object.fromEntries(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== ''),
  );
  const qs = new URLSearchParams(clean as Record<string, string>).toString();
  return request(`${JOURNAL}/trades${qs ? `?${qs}` : ''}`);
}

// ── positions ─────────────────────────────────────────────
export function getPositions() {
  return request(`${JOURNAL}/positions`);
}

// ── CSV import ────────────────────────────────────────────
export async function importCsv(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${JOURNAL}/trades/import-csv`, {
    method: 'POST',
    headers: { 'x-user-id': getUserId() },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export function getCsvTemplate() {
  const a = document.createElement('a');
  a.href = `${JOURNAL}/trades/import-csv/template`;
  a.download = 'trades_template.csv';
  a.click();
}

// ── reports (준비 중) ─────────────────────────────────────
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

export function getReportHistory(ticker: string) {
  return request(`${REPORT}/reports/${ticker}/history`);
}
