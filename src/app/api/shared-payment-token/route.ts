import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { CartItem } from '@/contexts/CartContext';
import { calculateOrderTotals } from '@/lib/order-calculations';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as unknown as Stripe.LatestApiVersion,
});

export async function POST(request: NextRequest) {
  try {
    const { cartItems, paymentMethodId, userEmail: serverUserEmail } = await request.json();

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

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method required' }, { status: 400 });
    }

    // Calculate total from cart items including tax and shipping
    const orderTotals = calculateOrderTotals(cartItems);
    const totalWithTaxAndShipping = orderTotals.total; // This includes subtotal + tax + shipping

    // Find or create Stripe customer
    let customer;
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length > 0) {
      customer = customers.data[0];
    } else {
      // Create new customer if none exists
      customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          source: 'genai-product-builder-spt'
        }
      });
    }

    // Generate a scoped payment token for this specific cart and user
    const sharedPaymentToken = await stripe.paymentIntents.create({
      amount: Math.round(totalWithTaxAndShipping * 100), // Convert to cents
      currency: 'usd',
      payment_method: paymentMethodId,
      customer: customer.id, // Use proper Stripe customer ID
      capture_method: 'manual', // Don't capture until agent confirms
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never' // Disable redirect-based payment methods for AI agent
      },
      metadata: {
        user_email: userEmail,
        cart_hash: generateCartHash(cartItems),
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
      },
      description: `Shared Payment Token for ${cartItems.length} items`
    });

    console.log('Generated SPT for user:', userEmail, 'Total:', totalWithTaxAndShipping);

    return NextResponse.json({
      success: true,
      shared_payment_token: sharedPaymentToken.id,
      amount: totalWithTaxAndShipping,
      currency: 'usd',
      expires_at: sharedPaymentToken.metadata.expires_at,
      cart_items: cartItems.length
    });

  } catch (error) {
    console.error('Error generating shared payment token:', error);
    return NextResponse.json(
      { error: 'Failed to generate payment token' },
      { status: 500 }
    );
  }
}

// Helper function to generate a hash of cart contents for validation
function generateCartHash(cartItems: CartItem[]): string {
  const cartString = cartItems
    .sort((a, b) => a.id.localeCompare(b.id)) // Sort for consistent hash
    .map(item => `${item.id}:${item.quantity}:${item.price}`)
    .join('|');
  
  // Simple hash for demo - in production use crypto.createHash
  return Buffer.from(cartString).toString('base64').slice(0, 16);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('token');

    if (!tokenId) {
      return NextResponse.json({ error: 'Token ID required' }, { status: 400 });
    }

    // Retrieve and validate the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(tokenId);

    if (paymentIntent.metadata.user_email !== session.user.email) {
      return NextResponse.json({ error: 'Invalid token ownership' }, { status: 403 });
    }

    const expiresAt = new Date(paymentIntent.metadata.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 410 });
    }

    return NextResponse.json({
      valid: true,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      expires_at: paymentIntent.metadata.expires_at,
      cart_hash: paymentIntent.metadata.cart_hash
    });

  } catch (error) {
    console.error('Error validating shared payment token:', error);
    return NextResponse.json(
      { error: 'Failed to validate token' },
      { status: 500 }
    );
  }
}