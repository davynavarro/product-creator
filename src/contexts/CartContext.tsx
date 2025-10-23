'use client';

import { createContext, useContext, useReducer, useEffect, useRef, useCallback, ReactNode } from 'react';

// Cart item interface
export interface CartItem {
  id: string;
  productName: string;
  slug: string;
  imageUrl: string;
  price: number;
  originalPrice?: number;
  currency: string;
  quantity: number;
  category: string;
  // Optional variant info for future expansion
  variant?: {
    size?: string;
    color?: string;
    style?: string;
  };
}

// Cart state interface
export interface CartState {
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
  currency: string;
  isLoading: boolean;
}

// Cart actions
type CartAction =
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'quantity'> & { quantity?: number } }
  | { type: 'REMOVE_ITEM'; payload: { id: string; variant?: CartItem['variant'] } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number; variant?: CartItem['variant'] } }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOAD_CART'; payload: CartItem[] };

// Helper function to create cart item key for variant support (future use)
// const getCartItemKey = (id: string, variant?: CartItem['variant']): string => {
//   if (!variant) return id;
//   const variantKey = Object.entries(variant)
//     .filter(([, value]) => value)
//     .map(([key, value]) => `${key}:${value}`)
//     .join('|');
//   return variantKey ? `${id}#${variantKey}` : id;
// };

// Helper function to find cart item by id and variant
const findCartItem = (items: CartItem[], id: string, variant?: CartItem['variant']): CartItem | undefined => {
  return items.find(item => 
    item.id === id && 
    JSON.stringify(item.variant || {}) === JSON.stringify(variant || {})
  );
};

// Cart reducer
const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { payload } = action;
      const existingItem = findCartItem(state.items, payload.id, payload.variant);
      
      let updatedItems: CartItem[];
      if (existingItem) {
        // Update existing item quantity
        updatedItems = state.items.map(item =>
          item === existingItem
            ? { ...item, quantity: item.quantity + (payload.quantity || 1) }
            : item
        );
      } else {
        // Add new item
        const newItem: CartItem = {
          ...payload,
          quantity: payload.quantity || 1,
        };
        updatedItems = [...state.items, newItem];
      }

      const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      return {
        ...state,
        items: updatedItems,
        totalItems,
        totalAmount,
      };
    }

    case 'REMOVE_ITEM': {
      const { id, variant } = action.payload;
      const updatedItems = state.items.filter(item => 
        !(item.id === id && JSON.stringify(item.variant || {}) === JSON.stringify(variant || {}))
      );

      const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      return {
        ...state,
        items: updatedItems,
        totalItems,
        totalAmount,
      };
    }

    case 'UPDATE_QUANTITY': {
      const { id, quantity, variant } = action.payload;
      
      if (quantity <= 0) {
        // Remove item if quantity is 0 or negative
        return cartReducer(state, { type: 'REMOVE_ITEM', payload: { id, variant } });
      }

      const updatedItems = state.items.map(item =>
        item.id === id && JSON.stringify(item.variant || {}) === JSON.stringify(variant || {})
          ? { ...item, quantity }
          : item
      );

      const totalItems = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      return {
        ...state,
        items: updatedItems,
        totalItems,
        totalAmount,
      };
    }

    case 'CLEAR_CART': {
      return {
        ...state,
        items: [],
        totalItems: 0,
        totalAmount: 0,
      };
    }

    case 'SET_LOADING': {
      return {
        ...state,
        isLoading: action.payload,
      };
    }

    case 'LOAD_CART': {
      const items = action.payload;
      const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      return {
        ...state,
        items,
        totalItems,
        totalAmount,
        isLoading: false,
      };
    }

    default:
      return state;
  }
};

// Initial cart state
const initialCartState: CartState = {
  items: [],
  totalItems: 0,
  totalAmount: 0,
  currency: 'USD',
  isLoading: true,
};

// Cart context
const CartContext = createContext<{
  state: CartState;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: string, variant?: CartItem['variant']) => void;
  updateQuantity: (id: string, quantity: number, variant?: CartItem['variant']) => void;
  clearCart: () => void;
  getItemQuantity: (id: string, variant?: CartItem['variant']) => number;
  isInCart: (id: string, variant?: CartItem['variant']) => boolean;
} | null>(null);

// Cart provider component
interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const hasLoadedRef = useRef(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('shopping-cart');
      if (savedCart) {
        const cartData = JSON.parse(savedCart) as CartItem[];
        dispatch({ type: 'LOAD_CART', payload: cartData });
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
      hasLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
      dispatch({ type: 'SET_LOADING', payload: false });
      hasLoadedRef.current = true;
    }
  }, []);

  // Save cart to localStorage whenever cart items change (but not during initial load)
  useEffect(() => {
    if (!state.isLoading && hasLoadedRef.current) {
      try {
        localStorage.setItem('shopping-cart', JSON.stringify(state.items));
      } catch (error) {
        console.error('Error saving cart to localStorage:', error);
      }
    }
  }, [state.items, state.isLoading]);

  // Cart actions (memoized to prevent unnecessary re-renders)
  const addItem = useCallback((item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  }, []);

  const removeItem = useCallback((id: string, variant?: CartItem['variant']) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id, variant } });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number, variant?: CartItem['variant']) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity, variant } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const getItemQuantity = (id: string, variant?: CartItem['variant']): number => {
    const item = findCartItem(state.items, id, variant);
    return item?.quantity || 0;
  };

  const isInCart = (id: string, variant?: CartItem['variant']): boolean => {
    return getItemQuantity(id, variant) > 0;
  };

  const contextValue = {
    state,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getItemQuantity,
    isInCart,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

// Custom hook to use cart context
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

// Utility functions for formatting
export const formatPrice = (price: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(price);
};

export const calculateDiscount = (originalPrice?: number, currentPrice?: number): string | null => {
  if (!originalPrice || !currentPrice || originalPrice <= currentPrice) {
    return null;
  }
  
  const discount = ((originalPrice - currentPrice) / originalPrice) * 100;
  return Math.round(discount).toString();
};