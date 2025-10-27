import Stripe from 'stripe';
import { PaymentProvider, Cart, CustomerInfo, SecureToken, PaymentResult, ShippingAddress, OrderSummary } from '../types';

export class StripePaymentProvider implements PaymentProvider {
  name = 'stripe';
  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-09-30.clover' as unknown as Stripe.LatestApiVersion,
    });
  }

  async validateCustomer(email: string): Promise<CustomerInfo> {
    try {
      const customers = await this.stripe.customers.list({
        email: email,
        limit: 1,
      });

      if (customers.data.length === 0) {
        return {
          email,
          hasPaymentMethods: false,
          hasShippingAddress: false
        };
      }

      const customer = customers.data[0];

      // Check if customer has payment methods
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customer.id,
        type: 'card',
      });

      return {
        email,
        hasPaymentMethods: paymentMethods.data.length > 0,
        hasShippingAddress: !!customer.shipping?.address
      };
    } catch (error) {
      console.error('Error validating Stripe customer:', error);
      return {
        email,
        hasPaymentMethods: false,
        hasShippingAddress: false
      };
    }
  }

  async createSecureToken(cart: Cart, customer: CustomerInfo, userEmail: string, orderTotals?: OrderSummary): Promise<SecureToken> {
    try {
      // Find or create Stripe customer
      let stripeCustomer;
      const customers = await this.stripe.customers.list({
        email: userEmail,
        limit: 1,
      });

      if (customers.data.length > 0) {
        stripeCustomer = customers.data[0];
      } else {
        stripeCustomer = await this.stripe.customers.create({
          email: userEmail,
          metadata: {
            source: 'ai-shopping-assistant'
          }
        });
      }

      // Get customer's default payment method
      let paymentMethodId = stripeCustomer.invoice_settings?.default_payment_method as string;
      
      if (!paymentMethodId) {
        // Get the first available payment method
        const paymentMethods = await this.stripe.paymentMethods.list({
          customer: stripeCustomer.id,
          type: 'card',
        });

        if (paymentMethods.data.length === 0) {
          throw new Error('No payment methods available');
        }

        paymentMethodId = paymentMethods.data[0].id;
      }

      // Calculate total in cents - use order totals if provided, otherwise fallback to cart total
      const totalAmount = orderTotals ? orderTotals.total : cart.totalAmount;
      const totalInCents = Math.round(totalAmount * 100);

      // Create payment intent with manual capture
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: totalInCents,
        currency: 'usd',
        payment_method: paymentMethodId,
        customer: stripeCustomer.id,
        capture_method: 'manual',
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never' // Disable redirect-based payment methods for AI agent
        },
        metadata: {
          user_email: userEmail,
          cart_hash: this.generateCartHash(cart),
          generated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
        },
        description: `AI Assistant Order - ${cart.items.length} items${orderTotals ? ` (Subtotal: $${orderTotals.subtotal}, Tax: $${orderTotals.tax}, Shipping: $${orderTotals.shipping})` : ''}`
      });

      return {
        token: paymentIntent.id,
        amount: totalAmount,
        currency: orderTotals?.currency || 'usd',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };
    } catch (error) {
      console.error('Error creating Stripe secure token:', error);
      throw new Error('Failed to create secure payment token');
    }
  }

  async capturePayment(token: string, cart: Cart, shippingInfo: ShippingAddress, userEmail: string, orderTotals?: OrderSummary): Promise<PaymentResult> {
    try {
      // Step 1: Retrieve the payment intent
      const paymentIntent = await this.stripe.paymentIntents.retrieve(token);

      // Step 2: Validate payment intent belongs to user
      if (paymentIntent.metadata.user_email !== userEmail) {
        throw new Error('Invalid payment token ownership');
      }

      // Step 3: Check if token is expired
      const expiresAt = new Date(paymentIntent.metadata.expires_at);
      if (expiresAt < new Date()) {
        throw new Error('Payment token has expired');
      }

      // Step 4: Validate cart hash (ensure cart hasn't changed)
      const currentCartHash = this.generateCartHash(cart);
      if (paymentIntent.metadata.cart_hash !== currentCartHash) {
        throw new Error('Cart contents have changed since payment authorization');
      }

      // Step 5: Confirm and capture the payment
      let finalPaymentIntent = paymentIntent;
      
      // If payment intent needs confirmation, confirm it first
      if (paymentIntent.status === 'requires_confirmation') {
        console.log('Payment intent requires confirmation, confirming...');
        finalPaymentIntent = await this.stripe.paymentIntents.confirm(token);
        console.log('Payment intent confirmed, status:', finalPaymentIntent.status);
      }
      
      // Now capture the payment
      const captureResult = await this.stripe.paymentIntents.capture(token);
      
      if (captureResult.status !== 'succeeded') {
        throw new Error(captureResult.last_payment_error?.message || 'Payment capture failed');
      }

      // Generate order ID (in a real system, this would be from your order management system)
      const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        success: true,
        orderId: orderId.toUpperCase(),
        transactionId: captureResult.id,
        total: orderTotals ? orderTotals.total : (captureResult.amount / 100),
        currency: orderTotals?.currency || captureResult.currency
      };
    } catch (error) {
      console.error('Error capturing Stripe payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed'
      };
    }
  }

  private generateCartHash(cart: Cart): string {
    const cartString = cart.items
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(item => `${item.id}:${item.quantity}:${item.price}`)
      .join('|');
    
    return Buffer.from(cartString).toString('base64').slice(0, 16);
  }
}