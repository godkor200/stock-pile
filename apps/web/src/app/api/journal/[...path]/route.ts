import { type NextRequest, NextResponse } from 'next/server';

const JOURNAL_URL = process.env.JOURNAL_URL ?? 'http://localhost:3001/api';

async function proxy(req: NextRequest, path: string): Promise<NextResponse> {
  const search = req.nextUrl.search;
  const target = `${JOURNAL_URL}/${path}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!['host', 'connection', 'accept-encoding'].includes(key)) headers.set(key, value);
  });
  headers.set('accept-encoding', 'identity');

  const body =
    req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: body as BodyInit,
  });

  const resHeaders = new Headers(upstream.headers);
  resHeaders.delete('content-encoding');
  resHeaders.delete('content-length');

  const resBody = await upstream.arrayBuffer();
  return new NextResponse(resBody, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
