import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as unknown as Stripe.LatestApiVersion,
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ paymentMethodId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentMethodId } = await params;

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 });
    }

    // Get the payment method to verify it belongs to the user
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    if (!paymentMethod.customer) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    }

    // Verify the customer belongs to the current user
    const customer = await stripe.customers.retrieve(paymentMethod.customer as string);
    
    if (!customer || customer.deleted || (customer as Stripe.Customer).email !== session.user.email) {
      return NextResponse.json({ error: 'Unauthorized to delete this payment method' }, { status: 403 });
    }

    // Detach the payment method from the customer
    await stripe.paymentMethods.detach(paymentMethodId);

    console.log(`Detached payment method ${paymentMethodId} from customer ${customer.id}`);

    return NextResponse.json({
      success: true,
      message: 'Payment method deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete payment method' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ paymentMethodId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentMethodId } = await params;
    const { setAsDefault } = await request.json();

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 });
    }

    // Get the payment method to verify it belongs to the user
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    
    if (!paymentMethod.customer) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    }

    // Verify the customer belongs to the current user
    const customer = await stripe.customers.retrieve(paymentMethod.customer as string);
    
    if (!customer || customer.deleted || (customer as Stripe.Customer).email !== session.user.email) {
      return NextResponse.json({ error: 'Unauthorized to modify this payment method' }, { status: 403 });
    }

    // Update default payment method
    if (setAsDefault !== undefined) {
      if (setAsDefault) {
        await stripe.customers.update(customer.id, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
        console.log(`Set payment method ${paymentMethodId} as default for customer ${customer.id}`);
      } else {
        // Remove default if this was the default method
        const currentCustomer = await stripe.customers.retrieve(customer.id) as Stripe.Customer;
        if (currentCustomer.invoice_settings?.default_payment_method === paymentMethodId) {
          await stripe.customers.update(customer.id, {
            invoice_settings: {
              default_payment_method: undefined,
            },
          });
          console.log(`Removed default payment method for customer ${customer.id}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment method updated successfully',
    });
  } catch (error) {
    console.error('Error updating payment method:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update payment method' },
      { status: 500 }
    );
  }
}