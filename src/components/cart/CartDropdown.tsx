'use client';

import { useRef, useEffect } from 'react';
import { X, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useCart, formatPrice } from '@/contexts/CartContext';
import Link from 'next/link';
import Image from 'next/image';

interface CartDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDropdown({ isOpen, onClose }: CartDropdownProps) {
  const { state, updateQuantity, removeItem } = useCart();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Shopping Cart</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Cart Content */}
      <div className="max-h-64 overflow-y-auto">
        {state.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-gray-500">
            <ShoppingBag className="h-12 w-12 mb-2 text-gray-300" />
            <p className="text-sm">Your cart is empty</p>
          </div>
        ) : (
          <div className="p-2">
            {state.items.map((item) => (
              <div key={`${item.id}-${JSON.stringify(item.variant || {})}`} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                {/* Product Image */}
                <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                  <Image
                    src={item.imageUrl}
                    alt={item.productName}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {item.productName}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-semibold text-blue-600">
                      {formatPrice(item.price, item.currency)}
                    </span>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <span className="text-xs text-gray-500 line-through">
                        {formatPrice(item.originalPrice, item.currency)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant)}
                    className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                    disabled={item.quantity <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  
                  <span className="w-8 text-center text-sm font-medium">
                    {item.quantity}
                  </span>
                  
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant)}
                    className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeItem(item.id, item.variant)}
                  className="p-1 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {state.items.length > 0 && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-900">Total:</span>
            <span className="font-bold text-lg text-blue-600">
              {formatPrice(state.totalAmount, state.currency)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Link
              href="/cart"
              onClick={onClose}
              className="block w-full text-center py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              View Cart
            </Link>
            <Link
              href="/checkout"
              onClick={onClose}
              className="block w-full text-center py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Checkout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}