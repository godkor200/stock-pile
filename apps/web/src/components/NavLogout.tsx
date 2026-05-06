'use client';

import { useEffect, useState } from 'react';
import { logout, isLoggedIn } from '@/lib/api';
import { usePathname } from 'next/navigation';

export function NavLogout() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, [pathname]);

  if (pathname === '/auth' || !loggedIn) return null;

  return (
    <button
      onClick={logout}
      className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
    >
      로그아웃
    </button>
  );
}
