/**
 * Example calculation providers for different e-commerce scenarios
 * Apps can use these as-is or create their own custom implementations
 */

import { TaxProvider, ShippingProvider, TaxCalculationContext, ShippingCalculationContext } from './types';

// Example: US-based tax calculation with state-specific rates
export class USTaxProvider implements TaxProvider {
  private stateTaxRates: Record<string, number> = {
    // 'CA': 0.0725, // California
    // 'NY': 0.08,   // New York
    // 'IL': 0.05,   // Illinois
    // 'TX': 0.0625, // Texas
    // 'FL': 0.06,   // Florida
    // 'WA': 0.065,  // Washington
    // Add more states as needed
  };

  calculateTax(context: TaxCalculationContext): number {
    const state = context.shippingAddress?.state;
    // console.log("Shipping address: ", context.shippingAddress)
    const taxRate = state ? this.stateTaxRates[state] || 0.08 : 0.08; // Default 8%
    return context.subtotal * taxRate;
  }
}

// Example: Tiered shipping with weight consideration
export class TieredShippingProvider implements ShippingProvider {
  calculateShipping(context: ShippingCalculationContext): number {
    const { subtotal, items, shippingAddress } = context;
    
    // Free shipping over threshold
    if (subtotal >= 75) return 0;
    
    // International shipping
    if (shippingAddress?.country && shippingAddress.country !== 'US') {
      return 25.00;
    }
    
    // Calculate based on item count (simple weight estimation)
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    
    if (itemCount <= 2) return 5.99;
    if (itemCount <= 5) return 9.99;
    return 14.99;
  }
}

// Example: No tax (for tax-exempt businesses)
export class NoTaxProvider implements TaxProvider {
  calculateTax(): number {
    return 0;
  }
}

// Example: Free shipping always (for premium services)
export class FreeShippingProvider implements ShippingProvider {
  calculateShipping(): number {
    return 0;
  }
}

// Example: Flat rate shipping
export class FlatRateShippingProvider implements ShippingProvider {
  constructor(private rate: number = 9.99) {}
  
  calculateShipping(): number {
    return this.rate;
  }
}

// Example: International tax provider using external service
export class InternationalTaxProvider implements TaxProvider {
  async calculateTax(context: TaxCalculationContext): Promise<number> {
    const { subtotal, shippingAddress } = context;
    
    // This would typically call an external tax service like TaxJar, Avalara, etc.
    // For demo purposes, we'll use simple logic
    
    if (!shippingAddress?.country) return 0;
    
    const taxRates: Record<string, number> = {
      'US': 0.08,
      'CA': 0.12,  // GST/HST
      'GB': 0.20,  // VAT
      'DE': 0.19,  // VAT
      'FR': 0.20,  // VAT
    };
    
    const rate = taxRates[shippingAddress.country] || 0;
    return subtotal * rate;
  }
}

// Example: Shopify-style shipping calculator
export class ShopifyStyleShippingProvider implements ShippingProvider {
  calculateShipping(context: ShippingCalculationContext): number {
    const { subtotal, shippingAddress } = context;
    
    // Free shipping threshold
    if (subtotal >= 50) return 0;
    
    // Zone-based shipping
    const isInternational = shippingAddress?.country !== 'US';
    
    if (isInternational) {
      return 15.00; // International shipping
    }
    
    // Domestic shipping
    return 7.99;
  }
}