'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AIShoppingWidgetProps {
  className?: string;
  style?: React.CSSProperties;
}

export function AIShoppingWidget({ 
  className = '',
  style = {} 
}: AIShoppingWidgetProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI shopping assistant. I can help you find products, manage your cart, and even complete purchases for you. What are you looking for today?',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !session?.user?.email) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      console.log('Sending message to AI chat API...');
      
      // Call the server-side API route
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const data = await response.json();
      console.log('Received AI response:', data);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: data.timestamp
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessage = (content: string) => {
    // Basic markdown support for links and tables
    let formatted = content
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline">$1</a>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');

    // Basic table support
    if (formatted.includes('|')) {
      const lines = formatted.split('<br />');
      const tableLines = [];
      let inTable = false;
      
      for (const line of lines) {
        if (line.includes('|') && line.split('|').length > 2) {
          if (!inTable) {
            tableLines.push('<table class="min-w-full border-collapse border border-gray-300 mt-2 mb-2 text-sm">');
            inTable = true;
          }
          
          const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
          if (cells.every(cell => cell.includes('-'))) {
            // Skip separator row
            continue;
          }
          
          const isHeader: boolean = tableLines.length === 1;
          const tag: string = isHeader ? 'th' : 'td';
          const cellClass: string = isHeader ? 'border border-gray-300 px-2 py-1 bg-gray-100 font-medium' : 'border border-gray-300 px-2 py-1';
          
          tableLines.push(`<tr>${cells.map((cell: string) => `<${tag} class="${cellClass}">${cell}</${tag}>`).join('')}</tr>`);
        } else {
          if (inTable) {
            tableLines.push('</table>');
            inTable = false;
          }
          tableLines.push(line);
        }
      }
      
      if (inTable) {
        tableLines.push('</table>');
      }
      
      formatted = tableLines.join('<br />');
    }

    return formatted;
  };

  if (!session?.user) {
    return (
      <div className={`ai-shopping-widget ${className}`} style={style}>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-sm">
          <p className="text-yellow-800">Please log in to use the AI shopping assistant.</p>
        </div>
      </div>
    );
  }

  const isFullWidth = className.includes('w-full');

  return (
    <div className={`ai-shopping-widget ${className}`} style={style}>
      <div className={`bg-white rounded-lg shadow-lg border h-[calc(100vh-120px)] ${isFullWidth ? 'w-full' : 'w-80'} flex flex-col`}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`${isFullWidth ? 'max-w-2xl' : 'max-w-xs'} px-3 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
                dangerouslySetInnerHTML={{
                  __html: formatMessage(message.content)
                }}
              />
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

            {/* Input */}
            <div className="border-t p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me about products..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  Send
                </button>
              </div>
            </div>
        </div>
      </div>
  );
}