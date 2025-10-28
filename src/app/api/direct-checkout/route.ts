import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { saveOrderToSupabase, OrderData } from '@/lib/supabase-storage';
import { CartItem } from '@/contexts/CartContext';
import { calculateOrderTotals } from '@/lib/order-calculations';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as unknown as Stripe.LatestApiVersion,
});

export async function POST(request: NextRequest) {
  try {
    const {
      cartItems,
      shippingInfo,
      paymentMethodId, // Optional: use saved payment method
      useDefaultPaymentMethod = false, // Use customer's default payment method
      orderNote,
      userEmail: serverUserEmail // For server-side calls from chat agent
    } = await request.json();

    // If userEmail is provided in request body, use it (for server-side calls)
    // Otherwise, use session authentication
    let userEmail: string;
    
    if (serverUserEmail) {
      // Server-side call with explicit user email
      userEmail = serverUserEmail;
    } else {
      // Regular client call - require session
      const session = await getServerSession(authOptions);
      
      if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      userEmail = session.user.email;
    }

    if (!cartItems || !shippingInfo) {
      return NextResponse.json({ 
        error: 'Missing required fields: cartItems, shippingInfo' 
      }, { status: 400 });
    }

    console.log('Direct checkout for user:', userEmail);

    // Step 1: Find customer in Stripe
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json({ 
        error: 'No payment methods found. Please add a payment method first.' 
      }, { status: 400 });
    }

    const customer = customers.data[0];

    // Step 2: Determine which payment method to use
    let finalPaymentMethodId = paymentMethodId;

    if (!finalPaymentMethodId && useDefaultPaymentMethod) {
      finalPaymentMethodId = customer.invoice_settings?.default_payment_method;
    }

    if (!finalPaymentMethodId) {
      // Get the first available payment method
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customer.id,
        type: 'card',
        limit: 1,
      });

      if (paymentMethods.data.length === 0) {
        return NextResponse.json({ 
          error: 'No payment methods found. Please add a payment method first.' 
        }, { status: 400 });
      }

      finalPaymentMethodId = paymentMethods.data[0].id;
    }

    // Step 3: Calculate totals using utility function
    const orderTotals = calculateOrderTotals(cartItems);
    const totalCents = Math.round(orderTotals.total * 100);

    // Validate minimum charge amount (50 cents for USD)
    if (totalCents < 50) {
      return NextResponse.json({ 
        error: 'Order total must be at least $0.50 USD' 
      }, { status: 400 });
    }

    // Step 4: Create and confirm payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      customer: customer.id,
      payment_method: finalPaymentMethodId,
      confirmation_method: 'automatic',
      confirm: true,
      off_session: true, // Indicates this is for a saved payment method
      metadata: {
        source: 'genai-product-builder-direct',
        user_email: userEmail,
        order_type: 'agent_direct_checkout',
        items_count: cartItems.length.toString(),
      },
    });

    if (paymentIntent.status !== 'succeeded') {
      let errorMessage = 'Payment failed';
      
      if (paymentIntent.last_payment_error) {
        errorMessage = paymentIntent.last_payment_error.message || errorMessage;
      }

      return NextResponse.json({ 
        error: errorMessage,
        requiresAction: paymentIntent.status === 'requires_action',
        clientSecret: paymentIntent.client_secret,
      }, { status: 402 });
    }

    // Step 5: Generate order ID and create order
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const orderData: OrderData = {
      orderId,
      paymentIntentId: paymentIntent.id,
      customerInfo: {
        firstName: shippingInfo.firstName,
        lastName: shippingInfo.lastName,
        email: userEmail,
        phone: shippingInfo.phone || '',
      },
      shippingAddress: {
        address: shippingInfo.address,
        city: shippingInfo.city,
        state: shippingInfo.state,
        zipCode: shippingInfo.zipCode,
        country: shippingInfo.country || 'US',
      },
      items: cartItems.map((item: CartItem) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        currency: item.currency,
      })),
      totals: {
        subtotal: orderTotals.subtotal,
        shipping: orderTotals.shipping,
        tax: orderTotals.tax,
        total: orderTotals.total,
        currency: 'USD',
      },
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    // Add order note to metadata if provided
    if (orderNote) {
      console.log('Order note:', orderNote);
    }

    // Step 6: Save order to Supabase
    await saveOrderToSupabase(orderData);

    console.log('Direct checkout completed successfully:', orderId);

    return NextResponse.json({
      success: true,
      orderId,
      paymentStatus: 'succeeded',
      message: 'Your order has been placed successfully!',
      orderData: {
        orderId,
        total: orderTotals.total,
        currency: 'USD',
        items: cartItems.length,
        status: 'confirmed'
      }
    });

  } catch (error) {
    console.error('Error in direct checkout:', error);
    
    // Handle specific Stripe errors
    if (error instanceof Stripe.errors.StripeCardError) {
      return NextResponse.json(
        { 
          error: 'Payment failed', 
          details: error.message,
          code: error.code 
        },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Checkout failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}