import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { saveOrderToSupabase, OrderData } from '@/lib/supabase-storage';
import { CartItem } from '@/contexts/CartContext';
import { calculateOrderTotals } from '@/lib/order-calculations';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      shared_payment_token,
      cartItems,
      shippingInfo,
      orderNote
    } = await request.json();

    if (!shared_payment_token || !cartItems || !shippingInfo) {
      return NextResponse.json({ 
        error: 'Missing required fields: shared_payment_token, cartItems, shippingInfo' 
      }, { status: 400 });
    }

    console.log('Agent-initiated checkout for user:', session.user.email);

    // Step 1: Validate the Shared Payment Token
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(shared_payment_token);
    } catch (error) {
      console.error('Invalid payment intent:', error);
      return NextResponse.json({ error: 'Invalid payment token' }, { status: 400 });
    }

    // Step 2: Security checks
    if (paymentIntent.metadata.user_email !== session.user.email) {
      return NextResponse.json({ error: 'Payment token ownership mismatch' }, { status: 403 });
    }

    const expiresAt = new Date(paymentIntent.metadata.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json({ error: 'Payment token expired' }, { status: 410 });
    }

    // Step 3: Validate cart contents match the token
    const currentCartHash = generateCartHash(cartItems);
    if (currentCartHash !== paymentIntent.metadata.cart_hash) {
      return NextResponse.json({ 
        error: 'Cart contents have changed since token generation' 
      }, { status: 400 });
    }

    // Step 4: Calculate totals using utility function
    const orderTotals = calculateOrderTotals(cartItems);

    // Note: This uses free shipping for SPT demo, but utility function handles regular shipping logic
    const total = orderTotals.subtotal + orderTotals.tax; // Free shipping for SPT demo

    // Verify amount matches payment intent
    if (Math.abs(total - (paymentIntent.amount / 100)) > 0.01) {
      return NextResponse.json({ 
        error: 'Order total mismatch with payment token' 
      }, { status: 400 });
    }

    // Step 5: Capture the payment
    const captureResult = await stripe.paymentIntents.capture(shared_payment_token);
    
    if (captureResult.status !== 'succeeded') {
      return NextResponse.json({ 
        error: 'Payment capture failed', 
        details: captureResult.last_payment_error?.message 
      }, { status: 402 });
    }

    // Step 6: Generate order ID and create order
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const orderData: OrderData = {
      orderId,
      paymentIntentId: shared_payment_token,
      customerInfo: {
        firstName: shippingInfo.firstName,
        lastName: shippingInfo.lastName,
        email: session.user.email,
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
        shipping: 0, // Free shipping for SPT demo
        tax: orderTotals.tax,
        total,
        currency: 'USD',
      },
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    // Add order note to metadata if provided
    if (orderNote) {
      console.log('Order note:', orderNote);
    }

    // Step 7: Save order to Supabase
    await saveOrderToSupabase(orderData);

    console.log('Agent checkout completed successfully:', orderId);

    return NextResponse.json({
      success: true,
      orderId,
      paymentStatus: 'succeeded',
      message: 'Your order has been placed successfully!',
      orderData: {
        orderId,
        total,
        currency: 'USD',
        items: cartItems.length,
        status: 'confirmed'
      }
    });

  } catch (error) {
    console.error('Error in agent checkout:', error);
    return NextResponse.json(
      { 
        error: 'Checkout failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Helper function to generate consistent cart hash (same as SPT endpoint)
function generateCartHash(cartItems: CartItem[]): string {
  const cartString = cartItems
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(item => `${item.id}:${item.quantity}:${item.price}`)
    .join('|');
  
  return Buffer.from(cartString).toString('base64').slice(0, 16);
}