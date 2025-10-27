'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ChatInterface from '@/components/ChatInterface';
// import Navigation from '@/components/Navigation';

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

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

  if (!session) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className=" bg-gray-50 flex flex-col">
      {/* <Navigation /> */}
      
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          
          <div className="flex-1 max-w-4xl mx-auto w-full">
            <ChatInterface />
          </div>
        </div>

        {/* Side Panel - Optional for future features */}
        <div className="hidden lg:block w-80 bg-white border-l">
          <div className="p-6">

            <div>
              <h4 className="font-large text-gray-900 mb-3">Sample Questions</h4>
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-blue-50 rounded text-blue-800">
                  &ldquo;Find me wireless headphones under $100&rdquo;
                </div>
                <div className="p-2 bg-blue-50 rounded text-blue-800">
                  &ldquo;Compare iPhone vs Android phones&rdquo;
                </div>
                <div className="p-2 bg-blue-50 rounded text-blue-800">
                  &ldquo;Show me what&apos;s in my cart&rdquo;
                </div>
                <div className="p-2 bg-blue-50 rounded text-blue-800">
                  &ldquo;Help me checkout and pay&rdquo;
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">💡 Pro Tips</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Be specific about your needs</li>
                <li>• Ask for comparisons between products</li>
                <li>• I can help add items to your cart</li>
                <li>• I can guide you through checkout</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}