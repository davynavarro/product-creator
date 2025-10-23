'use client';

import { useState } from 'react';
import { ShoppingCart, Check, Loader2 } from 'lucide-react';
import { useCart, CartItem } from '@/contexts/CartContext';

interface AddToCartButtonProps {
  product: {
    id: string;
    productName: string;
    slug: string;
    imageUrl: string;
    pricing: {
      price: number;
      originalPrice?: number;
      currency: string;
    };
    category: string;
  };
  variant?: CartItem['variant'];
  quantity?: number;
  className?: string;
  showQuantitySelector?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function AddToCartButton({
  product,
  variant,
  quantity = 1,
  className = '',
  showQuantitySelector = false,
  size = 'md'
}: AddToCartButtonProps) {
  const { addItem, isInCart, getItemQuantity } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(quantity);
  const [justAdded, setJustAdded] = useState(false);

  const currentQuantity = getItemQuantity(product.id, variant);
  const isProductInCart = isInCart(product.id, variant);

  const handleAddToCart = async () => {
    setIsAdding(true);
    
    try {
      const cartItem: Omit<CartItem, 'quantity'> & { quantity: number } = {
        id: product.id,
        productName: product.productName,
        slug: product.slug,
        imageUrl: product.imageUrl,
        price: product.pricing.price,
        originalPrice: product.pricing.originalPrice,
        currency: product.pricing.currency,
        category: product.category,
        variant,
        quantity: selectedQuantity,
      };

      addItem(cartItem);
      
      // Show success state
      setJustAdded(true);
      setTimeout(() => {
        setJustAdded(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error adding item to cart:', error);
    } finally {
      setIsAdding(false);
    }
  };

  // Size-specific styles
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const baseStyles = `
    inline-flex items-center gap-2 font-medium rounded-lg transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const buttonStyles = justAdded
    ? `${baseStyles} ${sizeStyles[size]} bg-green-600 text-white hover:bg-green-700`
    : isProductInCart
    ? `${baseStyles} ${sizeStyles[size]} bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200`
    : `${baseStyles} ${sizeStyles[size]} bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md`;

  return (
    <div className="space-y-2">
      {showQuantitySelector && (
        <div className="flex items-center gap-2">
          <label htmlFor="quantity" className="text-sm font-medium text-gray-700">
            Quantity:
          </label>
          <select
            id="quantity"
            value={selectedQuantity}
            onChange={(e) => setSelectedQuantity(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>
      )}

      <button
        onClick={handleAddToCart}
        disabled={isAdding}
        className={`${buttonStyles} ${className}`}
        aria-label={`Add ${product.productName} to cart`}
      >
        {isAdding ? (
          <>
            <Loader2 className={`${iconSizes[size]} animate-spin`} />
            Adding...
          </>
        ) : justAdded ? (
          <>
            <Check className={iconSizes[size]} />
            Added to Cart!
          </>
        ) : isProductInCart ? (
          <>
            <ShoppingCart className={iconSizes[size]} />
            In Cart ({currentQuantity})
          </>
        ) : (
          <>
            <ShoppingCart className={iconSizes[size]} />
            Add to Cart
          </>
        )}
      </button>

      {isProductInCart && !justAdded && (
        <p className="text-xs text-gray-500">
          {currentQuantity} item{currentQuantity > 1 ? 's' : ''} in cart
        </p>
      )}
    </div>
  );
}