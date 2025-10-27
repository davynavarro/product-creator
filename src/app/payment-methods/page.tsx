'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { PaymentMethodManager } from '@/components/PaymentMethodManager';

export default function PaymentMethodsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  useEffect(() => {
    if (status === 'loading') return; // Still loading
    
    if (status === 'unauthenticated') {
      router.push('/api/auth/signin');
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Payment Methods</h1>
            <p className="mt-1 text-gray-600">
              Manage your saved payment methods for faster checkout
            </p>
          </div>
          
          <div className="p-6">
            <PaymentMethodManager />
          </div>
        </div>
      </div>
    </div>
  );
}