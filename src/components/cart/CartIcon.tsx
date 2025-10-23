'use client';

import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useState } from 'react';
import CartDropdown from './CartDropdown';

export default function CartIcon() {
  const { state } = useCart();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors duration-200"
        aria-label={`Shopping cart with ${state.totalItems} items`}
      >
        <ShoppingCart className="h-6 w-6" />
        {state.totalItems > 0 && (
          <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs font-medium min-w-[20px] h-5 rounded-full flex items-center justify-center px-1">
            {state.totalItems > 99 ? '99+' : state.totalItems}
          </span>
        )}
      </button>

      {isDropdownOpen && (
        <CartDropdown 
          isOpen={isDropdownOpen} 
          onClose={() => setIsDropdownOpen(false)} 
        />
      )}
    </div>
  );
}