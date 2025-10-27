'use client';

import { useCart, formatPrice, CartItem } from '@/contexts/CartContext';
import { calculateOrderTotals } from '@/lib/order-calculations';
import { Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function CartPage() {
  const { state, updateQuantity, removeItem, clearCart } = useCart();

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 ">
        <div className="max-w-4xl mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-32 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 bg-gray-300 rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 text-black">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
          <div className="flex gap-4">
            {state.items.length > 0 && (
              <button
                onClick={async () => {
                  const success = await clearCart();
                  if (success) {
                    alert('Cart cleared successfully!');
                  } else {
                    alert('Failed to clear cart. Please try again.');
                  }
                }}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Clear Cart
              </button>
            )}
          </div>
        </div>

        {state.items.length === 0 ? (
          <EmptyCartState />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {state.items.map((item) => (
                <CartItemCard
                  key={`${item.id}-${JSON.stringify(item.variant || {})}`}
                  item={item}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                />
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <OrderSummary
                items={state.items}
                totalItems={state.totalItems}
                currency={state.currency}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyCartState() {
  return (
    <div className="text-center py-16">
      <ShoppingBag className="h-24 w-24 text-gray-300 mx-auto mb-4" />
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
      <p className="text-gray-600 mb-8">Looks like you haven&apos;t added anything to your cart yet.</p>
      <Link
        href="/products"
        className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Continue Shopping
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

interface CartItemCardProps {
  item: CartItem;
  onUpdateQuantity: (id: string, quantity: number, variant?: CartItem['variant']) => void;
  onRemove: (id: string, variant?: CartItem['variant']) => void;
}

function CartItemCard({ item, onUpdateQuantity, onRemove }: CartItemCardProps) {
  const itemTotal = item.price * item.quantity;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex gap-4">
        {/* Product Image */}
        <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-lg overflow-hidden">
          <Image
            src={item.imageUrl}
            alt={item.productName}
            width={96}
            height={96}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {item.productName}
              </h3>
              <p className="text-sm text-gray-500">{item.category}</p>
              {item.variant && Object.keys(item.variant).length > 0 && (
                <div className="flex gap-2 mt-1">
                  {Object.entries(item.variant).map(([key, value]) => value && (
                    <span key={key} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {key}: {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => onRemove(item.id, item.variant)}
              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Price and Quantity */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-blue-600">
                {formatPrice(item.price, item.currency)}
              </span>
              {item.originalPrice && item.originalPrice > item.price && (
                <span className="text-sm text-gray-500 line-through">
                  {formatPrice(item.originalPrice, item.currency)}
                </span>
              )}
            </div>

            {/* Quantity Controls */}
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1, item.variant)}
                  disabled={item.quantity <= 1}
                  className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                
                <span className="px-4 py-2 font-medium min-w-[3rem] text-center">
                  {item.quantity}
                </span>
                
                <button
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1, item.variant)}
                  className="p-2 hover:bg-gray-100 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="text-right">
                <div className="text-lg font-semibold text-gray-900">
                  {formatPrice(itemTotal, item.currency)}
                </div>
                {item.quantity > 1 && (
                  <div className="text-xs text-gray-500">
                    {item.quantity} × {formatPrice(item.price, item.currency)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface OrderSummaryProps {
  items: CartItem[];
  totalItems: number;
  currency: string;
}

function OrderSummary({ items, totalItems, currency }: OrderSummaryProps) {
  // Calculate totals using utility function
  const orderTotals = calculateOrderTotals(items);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
      
      <div className="space-y-3 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal ({totalItems} items)</span>
          <span className="font-medium">{formatPrice(orderTotals.subtotal, currency)}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Shipping</span>
          <span className="font-medium">
            {orderTotals.shipping === 0 ? (
              <span className="text-green-600">Free</span>
            ) : (
              formatPrice(orderTotals.shipping, currency)
            )}
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Tax</span>
          <span className="font-medium">{formatPrice(orderTotals.tax, currency)}</span>
        </div>
        
        <div className="border-t pt-3">
          <div className="flex justify-between">
            <span className="text-lg font-semibold text-gray-900">Total</span>
            <span className="text-lg font-bold text-blue-600">
              {formatPrice(orderTotals.total, currency)}
            </span>
          </div>
        </div>
      </div>

      {orderTotals.subtotal > 0 && orderTotals.subtotal < 50 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Add {formatPrice(50 - orderTotals.subtotal, currency)} more for free shipping!
          </p>
        </div>
      )}

      <div className="space-y-3">
        <Link
          href="/checkout"
          className="block w-full bg-blue-600 text-white text-center py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Proceed to Checkout
        </Link>
        
        <Link
          href="/products"
          className="block w-full border border-gray-300 text-gray-700 text-center py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}