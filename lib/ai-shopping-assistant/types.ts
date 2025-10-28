// Core types for AI Shopping Assistant

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  specifications?: Record<string, string | number | boolean>;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface Cart {
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
  sessionId: string;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
}

export interface OrderSummary {
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
}

// New configurable calculation interfaces
export interface TaxCalculationContext {
  subtotal: number;
  shippingAddress?: ShippingAddress;
  items: CartItem[];
}

export interface ShippingCalculationContext {
  subtotal: number;
  shippingAddress?: ShippingAddress;
  items: CartItem[];
  totalWeight?: number;
}

export interface TaxProvider {
  calculateTax(context: TaxCalculationContext): Promise<number> | number;
}

export interface ShippingProvider {
  calculateShipping(context: ShippingCalculationContext): Promise<number> | number;
}

export interface OrderCalculationsProvider {
  taxProvider?: TaxProvider;
  shippingProvider?: ShippingProvider;
  currency?: string;
}

export interface PaymentResult {
  success: boolean;
  orderId?: string;
  transactionId?: string;
  total?: number;
  currency?: string;
  error?: string;
}

export interface SecureToken {
  token: string;
  amount: number;
  currency: string;
  expiresAt: string;
}

export interface CustomerInfo {
  email: string;
  hasPaymentMethods: boolean;
  hasShippingAddress: boolean;
}

// Provider Interfaces
export interface ProductProvider {
  search(query: string, options?: { category?: string; limit?: number }): Promise<Product[]>;
}

export interface CartProvider {
  getCart(sessionId: string): Promise<Cart>;
  addItems(sessionId: string, items: Array<{ productId: string; quantity: number }>): Promise<Cart>;
  removeItems(sessionId: string, items: Array<{ productId: string; quantity?: number; removeAll?: boolean }>): Promise<Cart>;
  clearCart(sessionId: string): Promise<Cart>;
}

export interface PaymentProvider {
  name: string; // 'stripe', 'paypal', 'square', etc.
  createSecureToken(cart: Cart, customer: CustomerInfo, userEmail: string, orderTotals?: OrderSummary): Promise<SecureToken>;
  capturePayment(token: string, cart: Cart, shippingInfo: ShippingAddress, userEmail: string, orderTotals?: OrderSummary): Promise<PaymentResult>;
  validateCustomer(email: string): Promise<CustomerInfo>;
}

export interface AuthProvider {
  getCurrentUser(): Promise<{ email: string; name?: string } | null>;
  validateServerAuth(userEmail: string): Promise<boolean>;
}

export interface ProfileProvider {
  getShippingAddress(userEmail: string): Promise<ShippingAddress | null>;
}

// Configuration Interface
export interface AIShoppingConfig {
  // AI Configuration
  azureOpenAI: {
    endpoint: string;
    apiKey: string;
    deploymentName: string;
  };
  
  // Provider Implementations
  productProvider: ProductProvider;
  cartProvider: CartProvider;
  paymentProvider: PaymentProvider;
  authProvider?: AuthProvider;  // Optional - may be handled at API level
  profileProvider: ProfileProvider;
  
  // Order Calculations (optional - falls back to defaults)
  orderCalculations?: OrderCalculationsProvider;
  
  // UI Configuration
  ui?: {
    theme?: 'light' | 'dark' | 'auto';
    primaryColor?: string;
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    enableMarkdown?: boolean;
  };
  
  // Business Logic
  features?: {
    enableAutonomousCheckout?: boolean;
    enableProductRecommendations?: boolean;
    enableCartManagement?: boolean;
    maxCartItems?: number;
  };
}

// Chat Types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: string;
  actions?: ChatAction[];
  tool_call_id?: string;
  tool_calls?: unknown[];
}

export interface ChatAction {
  type: 'add_to_cart' | 'view_cart' | 'remove_from_cart' | 'preview_order' | 'checkout' | 'view_product' | 'search_products';
  data?: Record<string, unknown>;
  label: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
}