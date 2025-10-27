'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, CreditCard, Loader2, Plus } from 'lucide-react';
import { SavedPaymentMethod } from '@/types/payment';
import { getShippingFee, calculateTax } from '@/lib/order-calculations';

interface PaymentData {
  selectedPaymentMethodId?: string;
  billingAddress: {
    sameAsShipping: boolean;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
}

interface SavedPaymentMethodFormProps {
  data: PaymentData;
  onUpdate: (data: Partial<PaymentData>) => void;
  onNext: (paymentData?: { paymentMethodId: string; [key: string]: unknown }) => void;
  onBack: () => void;
  totalAmount: number; // This is the subtotal from cart
}

export default function SavedPaymentMethodForm({
  data,
  onUpdate,
  onNext,
  onBack,
  totalAmount
}: SavedPaymentMethodFormProps) {
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate proper totals using utility functions
  const subtotal = totalAmount; // This is the subtotal from cart
  const shipping = getShippingFee(subtotal);
  const tax = calculateTax(subtotal);
  const finalTotal = subtotal + shipping + tax;

  useEffect(() => {
    fetchPaymentMethods();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/payment-methods');
      const result = await response.json();
      
      if (result.success) {
        setPaymentMethods(result.paymentMethods);
        
        // Auto-select default payment method
        const defaultMethod = result.paymentMethods.find((pm: SavedPaymentMethod) => pm.isDefault);
        if (defaultMethod && !data.selectedPaymentMethodId) {
          onUpdate({ selectedPaymentMethodId: defaultMethod.id });
        }
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

  const handlePaymentMethodSelect = (paymentMethodId: string) => {
    onUpdate({ selectedPaymentMethodId: paymentMethodId });
    setError(null);
  };

  const handleNext = async () => {
    if (!data.selectedPaymentMethodId) {
      setError('Please select a payment method');
      return;
    }

    // Just validate and proceed to next step - don't process payment yet
    setError(null);
    onNext({ 
      paymentMethodId: data.selectedPaymentMethodId
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading payment methods...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center mb-6">
        <CreditCard className="h-6 w-6 text-blue-600 mr-3" />
        <h2 className="text-xl font-semibold text-gray-900">Payment Method</h2>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {paymentMethods.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <CreditCard className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Payment Methods</h3>
          <p className="text-gray-600 mb-4">You need to add a payment method to continue.</p>
          <button
            onClick={() => window.location.href = '/profile?tab=billing'}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Payment Method
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Select Payment Method</h3>
          
          {paymentMethods.map((paymentMethod) => (
            <div
              key={paymentMethod.id}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                data.selectedPaymentMethodId === paymentMethod.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handlePaymentMethodSelect(paymentMethod.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={data.selectedPaymentMethodId === paymentMethod.id}
                    onChange={() => handlePaymentMethodSelect(paymentMethod.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center space-x-3">
                    <CreditCard className="h-6 w-6 text-gray-400" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {paymentMethod.card?.brand} •••• {paymentMethod.card?.last4}
                        </span>
                        {paymentMethod.isDefault && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Expires {paymentMethod.card?.expMonth?.toString().padStart(2, '0')}/{paymentMethod.card?.expYear}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="pt-4">
            <button
              onClick={() => window.location.href = '/profile?tab=billing'}
              className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add New Payment Method
            </button>
          </div>
        </div>
      )}

      {/* Billing Address */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Billing Address</h3>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="sameAsShipping"
            checked={data.billingAddress.sameAsShipping}
            onChange={(e) => onUpdate({
              billingAddress: {
                ...data.billingAddress,
                sameAsShipping: e.target.checked
              }
            })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="sameAsShipping" className="text-sm text-gray-700">
            Same as shipping address
          </label>
        </div>
      </div>

      {/* Order Summary */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="text-gray-900">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Shipping</span>
            <span className="text-gray-900">
              {shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Tax</span>
            <span className="text-gray-900">${tax.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
          <span className="text-lg font-medium text-gray-900">Total</span>
          <span className="text-2xl font-bold text-gray-900">
            ${finalTotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <button
          onClick={onBack}
          className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Shipping
        </button>
        
        <button
          onClick={handleNext}
          disabled={!data.selectedPaymentMethodId || paymentMethods.length === 0}
          className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Review
          <ArrowRight className="h-4 w-4 ml-2" />
        </button>
      </div>
    </div>
  );
}