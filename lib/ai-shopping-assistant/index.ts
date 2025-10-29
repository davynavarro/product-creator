// Core exports
export { AIShoppingEngine } from './engine';
export { AIShoppingAssistant } from './component';

// Provider implementations
export { StripePaymentProvider } from './providers/stripe';

// Calculation providers for tax and shipping
export {
  USTaxProvider,
  TieredShippingProvider,
  NoTaxProvider,
  FreeShippingProvider,
  FlatRateShippingProvider,
  InternationalTaxProvider,
  ShopifyStyleShippingProvider
} from './calculation-providers';

// Types
export type {
  AIShoppingConfig,
  Product,
  CartItem,
  Cart,
  ShippingAddress,
  OrderSummary,
  PaymentResult,
  SecureToken,
  CustomerInfo,
  ProductProvider,
  CartProvider,
  PaymentProvider,
  AuthProvider,
  ProfileProvider,
  OrderProvider,
  OrderData,
  TaxProvider,
  ShippingProvider,
  OrderCalculationsProvider,
  TaxCalculationContext,
  ShippingCalculationContext,
  ChatMessage,
  ChatAction,
  ToolResult
} from './types';

import type { AIShoppingConfig } from './types';

// Helper function to create basic config
export function createAIShoppingConfig(config: Partial<AIShoppingConfig>): AIShoppingConfig {
  const defaultConfig: Partial<AIShoppingConfig> = {
    features: {
      enableAutonomousCheckout: true,
      enableProductRecommendations: true,
      enableCartManagement: true,
      maxCartItems: 50
    }
  };

  return { ...defaultConfig, ...config } as AIShoppingConfig;
}