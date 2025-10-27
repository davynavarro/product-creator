'use client';

import { useState } from 'react';
import { 
  useStripe, 
  useElements, 
  PaymentElement 
} from '@stripe/react-stripe-js';

interface AddPaymentMethodFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function AddPaymentMethodForm({ onSuccess, onError }: AddPaymentMethodFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [setAsDefault, setSetAsDefault] = useState(true);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    onError(''); // Clear any previous errors

    try {
      // Confirm the setup intent
      const { error: stripeError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-methods`,
        },
        redirect: 'if_required',
      });

      if (stripeError) {
        onError(stripeError.message || 'An error occurred while saving your payment method');
        setIsLoading(false);
        return;
      }

      if (setupIntent?.payment_method) {
        // Save the payment method to our backend
        const response = await fetch('/api/payment-methods', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentMethodId: setupIntent.payment_method,
            setAsDefault,
          }),
        });

        if (response.ok) {
          onSuccess();
        } else {
          const errorData = await response.json();
          onError(errorData.error || 'Failed to save payment method');
        }
      }
    } catch (err) {
      onError('An unexpected error occurred');
      console.error('Error saving payment method:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement 
        options={{
          layout: 'tabs',
        }}
      />
      
      <div className="flex items-center">
        <input
          id="setAsDefault"
          type="checkbox"
          checked={setAsDefault}
          onChange={(e) => setSetAsDefault(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="setAsDefault" className="ml-2 block text-sm text-gray-700">
          Set as default payment method
        </label>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="submit"
          disabled={!stripe || isLoading}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Saving...' : 'Save Payment Method'}
        </button>
      </div>
    </form>
  );
}