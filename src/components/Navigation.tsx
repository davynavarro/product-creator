'use client';

import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Settings, Package } from 'lucide-react';
import Image from 'next/image';
import CartIcon from '@/components/cart/CartIcon';
import SearchComponent from '@/components/SearchComponent';

export default function Navigation() {
  const { data: session, status } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-gray-900">
              GenAI Store
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Generate
            </Link>
            <Link
              href="/products"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              Products
            </Link>
            {session && (
              <>
                <Link
                  href="/chat"
                  className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
                >
                  🤖 AI Assistant
                </Link>
                <Link
                  href="/admin"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Admin
                </Link>
              </>
            )}
          </div>

          {/* Search */}
          <div className="hidden lg:block flex-1 max-w-md mx-8">
            <SearchComponent compact showFilters={false} />
          </div>

          {/* Right side - Cart and Auth */}
          <div className="flex items-center space-x-4">
            <CartIcon />
            
            {/* Authentication */}
            {status === 'loading' ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : session ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {session.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                  )}
                  <span className="hidden md:block text-sm font-medium">
                    {session.user?.name?.split(' ')[0] || 'User'}
                  </span>
                </button>

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">
                        {session.user?.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {session.user?.email}
                      </p>
                    </div>
                    <Link
                      href="/orders"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Package className="h-4 w-4 mr-3" />
                      My Orders
                    </Link>
                    <Link
                      href="/profile"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Settings className="h-4 w-4 mr-3" />
                      Profile Settings
                    </Link>
                    <Link
                      href="/payment-methods"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <svg className="h-4 w-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Payment Methods
                    </Link>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        signOut();
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => signIn()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}