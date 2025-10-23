'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  fallbackUrl?: string;
}

export default function ProtectedRoute({ 
  children, 
  requireAuth = true, 
  fallbackUrl = '/auth/signin' 
}: ProtectedRouteProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return; // Still loading

    if (requireAuth && !session) {
      const currentUrl = window.location.pathname + window.location.search;
      router.push(`${fallbackUrl}?callbackUrl=${encodeURIComponent(currentUrl)}`);
    }
  }, [session, status, requireAuth, router, fallbackUrl]);

  // Show loading while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If authentication is required but user is not authenticated, don't render children
  if (requireAuth && !session) {
    return null; // This will be brief before redirect
  }

  return <>{children}</>;
}