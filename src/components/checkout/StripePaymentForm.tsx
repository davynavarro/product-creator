'use client';

import { useState, useEffect } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { ArrowLeft, ArrowRight, CreditCard, Loader2 } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);

interface PaymentData {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  nameOnCard: string;
  billingAddress: {
    sameAsShipping: boolean;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
}

interface ShippingData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface PaymentFormProps {
  data: PaymentData;
  shippingData: ShippingData;
  onUpdate: (data: Partial<PaymentData>) => void;
  onNext: (paymentData?: { paymentIntentId: string; [key: string]: unknown }) => void;
  onBack: () => void;
  totalAmount: number;
}

// Stripe Card Input Component
function StripeCardForm({ 
  data, 
  shippingData, 
  onUpdate, 
  onNext, 
  onBack, 
  totalAmount 
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Create payment intent when component mounts
    const createPaymentIntent = async () => {
      try {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: totalAmount,
            currency: 'usd',
            metadata: {
              customerEmail: shippingData.email,
              customerName: `${shippingData.firstName} ${shippingData.lastName}`,
            },
          }),
        });

        const { clientSecret } = await response.json();
        setClientSecret(clientSecret);
      } catch (err) {
        setError('Failed to initialize payment. Please try again.');
        console.error('Error creating payment intent:', err);
      }
    };

    if (totalAmount > 0) {
      createPaymentIntent();
    }
  }, [totalAmount, shippingData.email, shippingData.firstName, shippingData.lastName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements || !clientSecret) {
      setError('Stripe is not properly initialized. Please refresh the page.');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Card information is missing. Please try again.');
      return;
    }

    if (!data.nameOnCard.trim()) {
      setError('Please enter the name on the card.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Confirm the payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: data.nameOnCard,
              email: shippingData.email,
              address: data.billingAddress.sameAsShipping
                ? {
                    line1: shippingData.address,
                    city: shippingData.city,
                    state: shippingData.state,
                    postal_code: shippingData.zipCode,
                    country: shippingData.country,
                  }
                : {
                    line1: data.billingAddress.address || '',
                    city: data.billingAddress.city || '',
                    state: data.billingAddress.state || '',
                    postal_code: data.billingAddress.zipCode || '',
                    country: data.billingAddress.country || '',
                  },
            },
          },
        }
      );

      if (stripeError) {
        setError(stripeError.message || 'Payment failed. Please try again.');
      } else if (paymentIntent?.status === 'succeeded') {
        // Payment succeeded, proceed to next step with payment data
        onNext({
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
        });
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Payment error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (field: keyof PaymentData | string, value: string | boolean) => {
    if (field === 'sameAsShipping') {
      onUpdate({
        billingAddress: {
          ...data.billingAddress,
          sameAsShipping: value as boolean,
        },
      });
    } else if (field.startsWith('billing.')) {
      const billingField = field.replace('billing.', '');
      onUpdate({
        billingAddress: {
          ...data.billingAddress,
          [billingField]: value,
        },
      });
    } else {
      onUpdate({ [field]: value });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Payment Information</h2>
          <p className="text-sm text-gray-600">
            Secure payment processing powered by Stripe
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Name on Card */}
      <div>
        <label htmlFor="nameOnCard" className="block text-sm font-medium text-gray-700 mb-2">
          Name on Card
        </label>
        <input
          type="text"
          id="nameOnCard"
          value={data.nameOnCard}
          onChange={(e) => handleInputChange('nameOnCard', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter name as it appears on card"
          required
        />
      </div>

      {/* Stripe Card Element */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Information
        </label>
        <div className="p-3 border border-gray-300 rounded-md bg-white">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#374151',
                  '::placeholder': {
                    color: '#9CA3AF',
                  },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Billing Address */}
      <div className="space-y-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="sameAsShipping"
            checked={data.billingAddress.sameAsShipping}
            onChange={(e) => handleInputChange('sameAsShipping', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="sameAsShipping" className="ml-2 block text-sm text-gray-700">
            Billing address is the same as shipping address
          </label>
        </div>

        {!data.billingAddress.sameAsShipping && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={data.billingAddress.address || ''}
                onChange={(e) => handleInputChange('billing.address', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={data.billingAddress.city || ''}
                onChange={(e) => handleInputChange('billing.city', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                value={data.billingAddress.state || ''}
                onChange={(e) => handleInputChange('billing.state', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP Code
              </label>
              <input
                type="text"
                value={data.billingAddress.zipCode || ''}
                onChange={(e) => handleInputChange('billing.zipCode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              <select
                value={data.billingAddress.country || ''}
                onChange={(e) => handleInputChange('billing.country', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Country</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="IT">Italy</option>
                <option value="ES">Spain</option>
                <option value="NL">Netherlands</option>
                <option value="BE">Belgium</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center space-x-2 px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Shipping</span>
        </button>
        <button
          type="submit"
          disabled={isProcessing || !stripe || !clientSecret}
          className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          <span>{isProcessing ? 'Processing...' : 'Continue to Review'}</span>
        </button>
      </div>
    </form>
  );
}

// Main PaymentForm wrapper component
export default function PaymentForm(props: PaymentFormProps) {
  const options: StripeElementsOptions = {
    appearance: {
      theme: 'stripe',
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <StripeCardForm {...props} />
    </Elements>
  );
}