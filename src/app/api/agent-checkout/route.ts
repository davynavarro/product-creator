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
      shared_payment_token,
      cartItems,
      shippingInfo,
      orderNote,
      userEmail: serverUserEmail // For server-side calls from chat agent
    } = await request.json();

    if (!shared_payment_token || !cartItems || !shippingInfo) {
      return NextResponse.json({ 
        error: 'Missing required fields: shared_payment_token, cartItems, shippingInfo' 
      }, { status: 400 });
    }

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

    console.log('Agent-initiated checkout for user:', userEmail);

    // Step 1: Validate the Shared Payment Token
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(shared_payment_token);
    } catch (error) {
      console.error('Invalid payment intent:', error);
      return NextResponse.json({ error: 'Invalid payment token' }, { status: 400 });
    }

    // Step 2: Security checks - validate token belongs to user
    if (paymentIntent.metadata.user_email !== userEmail) {
        console.log('Payment token user email:', paymentIntent.metadata.user_email);
      return NextResponse.json({ error: 'Payment token ownership mismatch' }, { status: 403 });
    }

    // Step 3: Security checks - token expiration
    const expiresAt = new Date(paymentIntent.metadata.expires_at);
    if (expiresAt < new Date()) {
        console.log('Payment token expired at:', expiresAt.toISOString());
      return NextResponse.json({ error: 'Payment token expired' }, { status: 410 });
    }

    // Step 3: Validate cart contents match the token
    const currentCartHash = generateCartHash(cartItems);
    if (currentCartHash !== paymentIntent.metadata.cart_hash) {
        console.log('Current cart hash:', currentCartHash);
        console.log('Payment token cart hash:', paymentIntent.metadata.cart_hash);
      return NextResponse.json({ 
        error: 'Cart contents have changed since token generation' 
      }, { status: 400 });
    }

    // Step 4: Calculate totals using utility function
    const orderTotals = calculateOrderTotals(cartItems);

    // Use full total including tax and shipping (should match SPT creation)
    const total = orderTotals.total; // This includes subtotal + tax + shipping

    // Verify amount matches payment intent
    if (Math.abs(total - (paymentIntent.amount / 100)) > 0.01) {
        console.log('Calculated total:', total);
        console.log('Payment intent amount:', paymentIntent.amount / 100);
      return NextResponse.json({ 
        error: 'Order total mismatch with payment token' 
      }, { status: 400 });
    }

    // Step 5: Confirm and capture the payment
    let finalPaymentIntent = paymentIntent;
    
    // If payment intent needs confirmation, confirm it first
    if (paymentIntent.status === 'requires_confirmation') {
      console.log('Payment intent requires confirmation, confirming...');
      finalPaymentIntent = await stripe.paymentIntents.confirm(shared_payment_token);
      console.log('Payment intent confirmed, status:', finalPaymentIntent.status);
    }
    
    // Now capture the payment
    const captureResult = await stripe.paymentIntents.capture(shared_payment_token);
    
    if (captureResult.status !== 'succeeded') {
      return NextResponse.json({ 
        error: 'Payment capture failed', 
        details: captureResult.last_payment_error?.message,
        status: captureResult.status
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