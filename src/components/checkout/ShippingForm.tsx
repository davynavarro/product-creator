'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowRight, Save } from 'lucide-react';

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

interface ShippingFormProps {
  data: ShippingData;
  onUpdate: (data: Partial<ShippingData>) => void;
  onNext: () => void;
}

export default function ShippingForm({ data, onUpdate, onNext }: ShippingFormProps) {
  const { data: session } = useSession();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveToProfile, setSaveToProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const saveAddressToProfile = async () => {
    if (!session?.user?.email) return;

    try {
      setIsSaving(true);
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile: {
            shippingAddress: {
              firstName: data.firstName,
              lastName: data.lastName,
              address1: data.address,
              city: data.city,
              state: data.state,
              postalCode: data.zipCode,
              country: data.country,
              phone: data.phone,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save address');
      }
    } catch (error) {
      console.error('Error saving address to profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    const newErrors: Record<string, string> = {};
    
    if (!data.firstName) newErrors.firstName = 'First name is required';
    if (!data.lastName) newErrors.lastName = 'Last name is required';
    if (!data.email) newErrors.email = 'Email is required';
    if (!data.address) newErrors.address = 'Address is required';
    if (!data.city) newErrors.city = 'City is required';
    if (!data.state) newErrors.state = 'State is required';
    if (!data.zipCode) newErrors.zipCode = 'ZIP code is required';
    
    // Email validation
    if (data.email && !/\S+@\S+\.\S+/.test(data.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length === 0) {
      // Save to profile if requested
      if (saveToProfile) {
        await saveAddressToProfile();
      }
      onNext();
    }
  };

  const handleInputChange = (field: keyof ShippingData, value: string) => {
    onUpdate({ [field]: value });
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Shipping Information</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              First Name *
            </label>
            <input
              type="text"
              id="firstName"
              value={data.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.firstName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter first name"
            />
            {errors.firstName && (
              <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Last Name *
            </label>
            <input
              type="text"
              id="lastName"
              value={data.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.lastName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter last name"
            />
            {errors.lastName && (
              <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              value={data.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="your@email.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              value={data.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
            Street Address *
          </label>
          <input
            type="text"
            id="address"
            value={data.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.address ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="123 Main Street"
          />
          {errors.address && (
            <p className="mt-1 text-sm text-red-600">{errors.address}</p>
          )}
        </div>

        {/* City, State, ZIP */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
              City *
            </label>
            <input
              type="text"
              id="city"
              value={data.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.city ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="New York"
            />
            {errors.city && (
              <p className="mt-1 text-sm text-red-600">{errors.city}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
              State *
            </label>
            <select
              id="state"
              value={data.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.state ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select state</option>
              <option value="CA">California</option>
              <option value="IL">Illinois</option>
              <option value="NY">New York</option>
              <option value="TX">Texas</option>
              <option value="FL">Florida</option>
              {/* Add more states as needed */}
            </select>
            {errors.state && (
              <p className="mt-1 text-sm text-red-600">{errors.state}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-1">
              ZIP Code *
            </label>
            <input
              type="text"
              id="zipCode"
              value={data.zipCode}
              onChange={(e) => handleInputChange('zipCode', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.zipCode ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="12345"
            />
            {errors.zipCode && (
              <p className="mt-1 text-sm text-red-600">{errors.zipCode}</p>
            )}
          </div>
        </div>

        {/* Country */}
        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
            Country
          </label>
          <select
            id="country"
            value={data.country}
            onChange={(e) => handleInputChange('country', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            {/* Add more countries as needed */}
          </select>
        </div>

        {/* Save to Profile Option */}
        {session && (
          <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
            <input
              type="checkbox"
              id="saveToProfile"
              checked={saveToProfile}
              onChange={(e) => setSaveToProfile(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="saveToProfile" className="flex items-center text-sm font-medium text-gray-700">
              <Save className="h-4 w-4 mr-1" />
              Save this address to my profile for future orders
            </label>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isSaving ? 'Saving...' : 'Continue to Payment'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}