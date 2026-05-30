'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isLoggedIn } from '@/lib/api';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoggedIn() && pathname !== '/auth' && pathname !== '/about' && pathname !== '/tasks') {
      router.replace('/auth');
    }
  }, [pathname, router]);

  return <>{children}</>;
}
