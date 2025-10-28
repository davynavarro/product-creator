import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as unknown as Stripe.LatestApiVersion,
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;

    // Find or create Stripe customer
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      // No customer exists yet, return empty payment methods
      return NextResponse.json({
        success: true,
        paymentMethods: [],
        defaultPaymentMethod: null,
      });
    }

    const customer = customers.data[0];

    // Get payment methods for the customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: 'card',
    });

    // Format payment methods for the client
    const formattedPaymentMethods = paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      } : null,
      isDefault: customer.invoice_settings?.default_payment_method === pm.id,
    }));

    return NextResponse.json({
      success: true,
      paymentMethods: formattedPaymentMethods,
      defaultPaymentMethod: customer.invoice_settings?.default_payment_method || null,
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentMethodId, setAsDefault } = await request.json();

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 });
    }

    const userEmail = session.user.email;
    const userName = session.user.name || '';

    // Find or create Stripe customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      // Create new customer
      customer = await stripe.customers.create({
        email: userEmail,
        name: userName,
        metadata: {
          source: 'genai-product-builder',
        },
      });
      console.log(`Created new Stripe customer: ${customer.id} for ${userEmail}`);
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });

    console.log(`Attached payment method ${paymentMethodId} to customer ${customer.id}`);

    // Set as default if requested
    if (setAsDefault) {
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
      console.log(`Set payment method ${paymentMethodId} as default for customer ${customer.id}`);
    }

    // Get the updated payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    return NextResponse.json({
      success: true,
      message: 'Payment method saved successfully',
      paymentMethod: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
        } : null,
        isDefault: setAsDefault || false,
      },
      customerId: customer.id,
    });
  } catch (error) {
    console.error('Error saving payment method:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save payment method' },
      { status: 500 }
    );
  }
}