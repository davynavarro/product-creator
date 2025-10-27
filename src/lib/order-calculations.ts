/**
 * Utility functions for calculating order totals, taxes, and shipping fees
 * This ensures consistent calculations across the entire application
 */

export interface CartItem {
  price: number;
  quantity: number;
}

export interface OrderTotals {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
}

/**
 * Calculate order totals including subtotal, shipping, tax, and total
 * @param items - Array of cart items with price and quantity
 * @param currency - Currency code (default: 'USD')
 * @returns OrderTotals object with all calculated values
 */
export function calculateOrderTotals(items: CartItem[], currency: string = 'USD'): OrderTotals {
  // Calculate subtotal
  const subtotal = items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);

  // Calculate shipping (free shipping over $50, otherwise $9.99)
  const shipping = subtotal > 50 ? 0 : 9.99;

  // Calculate tax (8% of subtotal)
  const tax = subtotal * 0.08;

  // Calculate total
  const total = subtotal + shipping + tax;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    shipping: Number(shipping.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    total: Number(total.toFixed(2)),
    currency
  };
}

/**
 * Calculate total amount in cents for Stripe payment processing
 * @param items - Array of cart items with price and quantity
 * @returns Total amount in cents (rounded to nearest cent)
 */
export function calculateTotalCents(items: CartItem[]): number {
  const totals = calculateOrderTotals(items);
  return Math.round(totals.total * 100);
}

/**
 * Get shipping fee based on subtotal
 * @param subtotal - Order subtotal amount
 * @returns Shipping fee amount
 */
export function getShippingFee(subtotal: number): number {
  return subtotal > 50 ? 0 : 9.99;
}

/**
 * Calculate tax based on subtotal
 * @param subtotal - Order subtotal amount
 * @param taxRate - Tax rate (default: 0.08 for 8%)
 * @returns Tax amount
 */
export function calculateTax(subtotal: number, taxRate: number = 0.08): number {
  return Number((subtotal * taxRate).toFixed(2));
}