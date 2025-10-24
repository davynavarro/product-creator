'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, CreditCard } from 'lucide-react';

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
  onNext: () => void;
  onBack: () => void;
}

export default function PaymentForm({ data, onUpdate, onNext, onBack }: PaymentFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    const newErrors: Record<string, string> = {};
    
    if (!data.cardNumber) newErrors.cardNumber = 'Card number is required';
    if (!data.expiryDate) newErrors.expiryDate = 'Expiry date is required';
    if (!data.cvv) newErrors.cvv = 'CVV is required';
    if (!data.nameOnCard) newErrors.nameOnCard = 'Name on card is required';
    
    // Card number validation (basic)
    if (data.cardNumber && data.cardNumber.replace(/\s/g, '').length < 16) {
      newErrors.cardNumber = 'Please enter a valid card number';
    }
    
    // CVV validation
    if (data.cvv && (data.cvv.length < 3 || data.cvv.length > 4)) {
      newErrors.cvv = 'CVV must be 3 or 4 digits';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length === 0) {
      onNext();
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
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment Information</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Card Details
          </h3>
          
          <div>
            <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Card Number *
            </label>
            <input
              type="text"
              id="cardNumber"
              value={data.cardNumber}
              onChange={(e) => {
                const formatted = formatCardNumber(e.target.value);
                handleInputChange('cardNumber', formatted);
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.cardNumber ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
            />
            {errors.cardNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.cardNumber}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700 mb-1">
                Expiry Date *
              </label>
              <input
                type="text"
                id="expiryDate"
                value={data.expiryDate}
                onChange={(e) => {
                  const formatted = formatExpiryDate(e.target.value);
                  handleInputChange('expiryDate', formatted);
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.expiryDate ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="MM/YY"
                maxLength={5}
              />
              {errors.expiryDate && (
                <p className="mt-1 text-sm text-red-600">{errors.expiryDate}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-1">
                CVV *
              </label>
              <input
                type="text"
                id="cvv"
                value={data.cvv}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  handleInputChange('cvv', value);
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.cvv ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="123"
                maxLength={4}
              />
              {errors.cvv && (
                <p className="mt-1 text-sm text-red-600">{errors.cvv}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="nameOnCard" className="block text-sm font-medium text-gray-700 mb-1">
              Name on Card *
            </label>
            <input
              type="text"
              id="nameOnCard"
              value={data.nameOnCard}
              onChange={(e) => handleInputChange('nameOnCard', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.nameOnCard ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="John Doe"
            />
            {errors.nameOnCard && (
              <p className="mt-1 text-sm text-red-600">{errors.nameOnCard}</p>
            )}
          </div>
        </div>

        {/* Billing Address */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Billing Address</h3>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="sameAsShipping"
              checked={data.billingAddress.sameAsShipping}
              onChange={(e) => handleInputChange('sameAsShipping', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="sameAsShipping" className="ml-2 text-sm text-gray-700">
              Same as shipping address
            </label>
          </div>

          {!data.billingAddress.sameAsShipping && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label htmlFor="billingAddress" className="block text-sm font-medium text-gray-700 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  id="billingAddress"
                  value={data.billingAddress.address || ''}
                  onChange={(e) => handleInputChange('billing.address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123 Main Street"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="billingCity" className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    id="billingCity"
                    value={data.billingAddress.city || ''}
                    onChange={(e) => handleInputChange('billing.city', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="New York"
                  />
                </div>
                
                <div>
                  <label htmlFor="billingState" className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <select
                    id="billingState"
                    value={data.billingAddress.state || ''}
                    onChange={(e) => handleInputChange('billing.state', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select state</option>
                    <option value="CA">California</option>
                    <option value="IL">Illinois</option>
                    <option value="NY">New York</option>
                    <option value="TX">Texas</option>
                    <option value="FL">Florida</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="billingZip" className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    id="billingZip"
                    value={data.billingAddress.zipCode || ''}
                    onChange={(e) => handleInputChange('billing.zipCode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="12345"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Shipping
          </button>
          
          <button
            type="submit"
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Review Order
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}