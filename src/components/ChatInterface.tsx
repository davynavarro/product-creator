'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, ShoppingCart, Package, Search, Loader2, Bot, User, CreditCard } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actions?: ChatAction[];
  products?: Product[];
}

interface ChatAction {
  type: 'add_to_cart' | 'view_cart' | 'checkout' | 'view_product' | 'search_products' | 'compare_products';
  data?: Record<string, unknown>;
  label: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
}

interface ChatInterfaceProps {
  className?: string;
}

export default function ChatInterface({ className = '' }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your shopping assistant. I can help you search for products, compare items, manage your cart, and complete your purchase. What can I help you find today?",
      timestamp: new Date().toISOString(),
      actions: [
        { type: 'search_products', label: 'Search Products', data: {} },
        { type: 'view_cart', label: 'View Cart', data: {} }
      ]
    }
  ]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);



  // Function to render message content with markdown support including tables
  const renderMessageContent = (content: string) => {
    return (
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto mt-3 mb-3">
              <table className="min-w-full border-collapse border border-gray-300 text-sm" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-gray-50" {...props}>
              {children}
            </thead>
          ),
          th: ({ children, ...props }) => (
            <th className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-900" {...props}>
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="border border-gray-300 px-3 py-2" {...props}>
              {children}
            </td>
          ),
          tr: ({ children, ...props }) => (
            <tr className="hover:bg-gray-50" {...props}>
              {children}
            </tr>
          ),
          p: ({ children, ...props }) => (
            <p className="mb-2 last:mb-0" {...props}>
              {children}
            </p>
          ),
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-gray-900" {...props}>
              {children}
            </strong>
          ),
          a: ({ children, href, ...props }) => {
            // Check if it's an internal link (starts with /)
            if (href && href.startsWith('/')) {
              return (
                <Link 
                  href={href} 
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                  {...props}
                >
                  {children}
                </Link>
              );
            }
            // External links
            return (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 hover:text-blue-800 underline"
                {...props}
              >
                {children}
              </a>
            );
          }
        }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  };
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageContent?: string, action?: ChatAction) => {
    const content = messageContent || input;
    if (!content.trim() && !action) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          action
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        timestamp: data.timestamp || new Date().toISOString(),
        actions: data.actions || [],
        products: data.products || []
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleActionClick = (action: ChatAction) => {
    const actionMessages: Record<string, string> = {
      'search_products': 'Search for products',
      'view_cart': 'Show me my cart',
      'checkout': 'I want to checkout',
      'view_product': `Show me details for this product`,
      'compare_products': 'Compare these products'
    };
    
    sendMessage(actionMessages[action.type] || action.label, action);
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'search_products': return <Search className="w-4 h-4" />;
      case 'view_cart': return <ShoppingCart className="w-4 h-4" />;
      case 'checkout': return <CreditCard className="w-4 h-4" />;
      case 'view_product': return <Package className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className={`flex flex-col h-[calc(100vh-70px)] overflow-hidden bg-white ${className}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
            )}
            
            <div className={`max-w-[80%] ${message.role === 'user' ? 'order-1' : 'order-2'}`}>
              <div
                className={`rounded-2xl px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white ml-auto'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {renderMessageContent(message.content)}
              </div>
              
              {/* Product Cards */}
              {message.products && message.products.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.products.map((product) => (
                    <div key={product.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{product.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{product.category}</p>
                          <p className="text-sm text-gray-700 mt-1 line-clamp-2">{product.description}</p>
                        </div>
                        <div className="text-right ml-3">
                          <div className="font-bold text-lg text-blue-600">${product.price}</div>
                          <button
                            onClick={() => handleActionClick({
                              type: 'add_to_cart',
                              label: 'Add to Cart',
                              data: { productId: product.id }
                            })}
                            className="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                          >
                            Add to Cart
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Action Buttons */}
              {message.actions && message.actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleActionClick(action)}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                    >
                      {getActionIcon(action.type)}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
              
              <div className="text-xs text-gray-500 mt-2">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 order-2">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-blue-600" />
            </div>
            <div className="bg-gray-100 rounded-2xl px-4 py-3 max-w-[80%]">
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="border-t bg-gray-50 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about products, your cart, or placing an order..."
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        
        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => handleActionClick({ type: 'search_products', label: 'Search Products', data: {} })}
            className="inline-flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm hover:bg-gray-300 transition-colors"
          >
            <Search className="w-3 h-3" />
            Search
          </button>
          <button
            onClick={() => handleActionClick({ type: 'view_cart', label: 'View Cart', data: {} })}
            className="inline-flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm hover:bg-gray-300 transition-colors"
          >
            <ShoppingCart className="w-3 h-3" />
            Cart
          </button>
          <button
            onClick={() => sendMessage("What are your most popular products?")}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm hover:bg-gray-300 transition-colors"
          >
            Popular Items
          </button>
          <button
            onClick={() => sendMessage("Show me deals and discounts")}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm hover:bg-gray-300 transition-colors"
          >
            Deals
          </button>
        </div>
      </div>
    </div>
  );
}