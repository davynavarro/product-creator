'use client';

import { useSession } from 'next-auth/react';
import { AIShoppingAssistant } from '../../../lib/ai-shopping-assistant/component';

export default function AITestPage() {
  const { data: session } = useSession();

  return (
    <div className="bg-gray-50">

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* AI Shopping Assistant - Library Component */}
        <div className="bg-white rounded-lg shadow">
          <div className="h-[calc(100vh-150px)]">
            {session?.user?.email ? (
              <AIShoppingAssistant 
                chatApiUrl="/api/ai-chat"
                userEmail={session.user.email}
                className="w-full h-full"
                style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Please log in to use the AI shopping assistant.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}