'use client';

import { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { SavedPaymentMethod, PaymentMethodsResponse, SetupIntentResponse } from '@/types/payment';
import { AddPaymentMethodForm } from './AddPaymentMethodForm';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);

export function PaymentMethodManager() {
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payment-methods');
      const data: PaymentMethodsResponse = await response.json();
      
      if (data.success) {
        setPaymentMethods(data.paymentMethods);
      } else {
        setError('Failed to load payment methods');
      }
    } catch (err) {
      setError('Failed to load payment methods');
      console.error('Error fetching payment methods:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    try {
      setError(null);
      const response = await fetch('/api/payment-methods/setup-intent', {
        method: 'POST',
      });
      
      const data: SetupIntentResponse = await response.json();
      
      if (data.success) {
        setSetupClientSecret(data.clientSecret);
        setShowAddForm(true);
      } else {
        setError('Failed to initialize payment method setup');
      }
    } catch (err) {
      setError('Failed to initialize payment method setup');
      console.error('Error creating setup intent:', err);
    }
  };

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/payment-methods/${paymentMethodId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Remove from local state
        setPaymentMethods(prev => prev.filter(pm => pm.id !== paymentMethodId));
      } else {
        setError('Failed to delete payment method');
      }
    } catch (err) {
      setError('Failed to delete payment method');
      console.error('Error deleting payment method:', err);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      setError(null);
      const response = await fetch(`/api/payment-methods/${paymentMethodId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ setAsDefault: true }),
      });
      
      if (response.ok) {
        // Update local state
        setPaymentMethods(prev => prev.map(pm => ({
          ...pm,
          isDefault: pm.id === paymentMethodId
        })));
      } else {
        setError('Failed to set default payment method');
      }
    } catch (err) {
      setError('Failed to set default payment method');
      console.error('Error setting default payment method:', err);
    }
  };

  const onPaymentMethodAdded = () => {
    setShowAddForm(false);
    setSetupClientSecret(null);
    fetchPaymentMethods(); // Refresh the list
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading payment methods...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Add Payment Method Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Saved Payment Methods</h3>
        <button
          onClick={handleAddPaymentMethod}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={showAddForm}
        >
          Add Payment Method
        </button>
      </div>

      {/* Add Payment Method Form */}
      {showAddForm && setupClientSecret && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-medium text-gray-900">Add New Payment Method</h4>
            <button
              onClick={() => {
                setShowAddForm(false);
                setSetupClientSecret(null);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <Elements 
            stripe={stripePromise} 
            options={{ 
              clientSecret: setupClientSecret,
              appearance: {
                theme: 'stripe',
              },
            }}
          >
            <AddPaymentMethodForm
              onSuccess={onPaymentMethodAdded}
              onError={(error: string) => setError(error)}
            />
          </Elements>
        </div>
      )}

      {/* Payment Methods List */}
      {paymentMethods.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No payment methods</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by adding a payment method.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paymentMethods.map((paymentMethod) => (
            <div
              key={paymentMethod.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {paymentMethod.card?.brand} •••• {paymentMethod.card?.last4}
                      </span>
                      {paymentMethod.isDefault && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      Expires {paymentMethod.card?.expMonth?.toString().padStart(2, '0')}/{paymentMethod.card?.expYear}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {!paymentMethod.isDefault && (
                    <button
                      onClick={() => handleSetDefault(paymentMethod.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Set as Default
                    </button>
                  )}
                  <button
                    onClick={() => handleDeletePaymentMethod(paymentMethod.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}