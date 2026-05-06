import { AuthGuard } from '@/components/AuthGuard';
import { NavLogout } from '@/components/NavLogout';
import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stock Pile',
  description: '개인 투자 어시스턴트',
};

const NAV = [
  { href: '/chat', label: '매매 입력/투자 질문' },
  // { href: '/import', label: 'CSV 가져오기' }, // 추후 활성화
  { href: '/trades', label: '거래 내역' },
  { href: '/positions', label: '포지션' },
  { href: '/reports', label: '종목 분석' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50">
        <AuthGuard>
          <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-6">
            <Link href="/chat" className="font-bold text-blue-600 text-lg">
              Stock Pile
            </Link>
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
              >
                {n.label}
              </Link>
            ))}
            <NavLogout />
          </nav>
          <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
        </AuthGuard>
      </body>
    </html>
  );
}
