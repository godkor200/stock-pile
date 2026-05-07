import { type NextRequest, NextResponse } from 'next/server';

const REPORT_URL = process.env.REPORT_URL ?? 'http://localhost:3002/api';

async function proxy(req: NextRequest, path: string): Promise<NextResponse> {
  const search = req.nextUrl.search;
  const target = `${REPORT_URL}/${path}${search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!['host', 'connection'].includes(key)) headers.set(key, value);
  });

  const body =
    req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text();

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: body as BodyInit,
  });

  const resBody = await upstream.arrayBuffer();
  return new NextResponse(resBody, {
    status: upstream.status,
    headers: upstream.headers,
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
