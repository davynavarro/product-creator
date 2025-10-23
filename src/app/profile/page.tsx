'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { User, Mail, Calendar, Shield, MapPin, CreditCard, Settings, Save, AlertCircle } from 'lucide-react';
import { UserProfile, Address, PaymentPreferences } from '@/types/user';

export default function ProfilePage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('account');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [shippingAddress, setShippingAddress] = useState<Address>({
    firstName: '',
    lastName: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    phone: '',
  });

  const [billingAddress, setBillingAddress] = useState<Address>({
    firstName: '',
    lastName: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    phone: '',
  });

  const [useBillingAsShipping, setUseBillingAsShipping] = useState(true);
  const [paymentPreferences, setPaymentPreferences] = useState<PaymentPreferences>({
    saveCards: false,
    autoFillShipping: true,
    autoFillBilling: true,
  });

  useEffect(() => {
    if (session?.user?.email) {
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/profile');
      const data = await response.json();
      
      if (data.success && data.profile) {
        setProfile(data.profile);
        if (data.profile.shippingAddress) {
          setShippingAddress(data.profile.shippingAddress);
        }
        if (data.profile.billingAddress) {
          setBillingAddress(data.profile.billingAddress);
        }
        setUseBillingAsShipping(data.profile.useBillingAsShipping);
        setPaymentPreferences(data.profile.paymentPreferences);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Failed to load profile information');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile: {
            shippingAddress,
            billingAddress: useBillingAsShipping ? shippingAddress : billingAddress,
            useBillingAsShipping,
            paymentPreferences,
          },
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setProfile(data.profile);
        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setError('Failed to save profile information');
    } finally {
      setSaving(false);
    }
  };

  if (!session?.user) return null;

  const tabs = [
    { id: 'account', label: 'Account Info', icon: User },
    { id: 'shipping', label: 'Shipping Address', icon: MapPin },
    { id: 'billing', label: 'Billing & Payment', icon: CreditCard },
    { id: 'preferences', label: 'Preferences', icon: Settings },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
            <p className="mt-2 text-gray-600">
              Manage your account information and payment preferences
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-green-800">{success}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 px-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading profile...</p>
              </div>
            ) : (
              <div className="p-6">
                {/* Account Info Tab */}
                {activeTab === 'account' && (
                  <div className="space-y-6">
                    <div className="flex items-center space-x-4 mb-6">
                      {session.user.image ? (
                        <img
                          src={session.user.image}
                          alt={session.user.name || 'User'}
                          className="w-16 h-16 rounded-full"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
                          <User className="h-8 w-8 text-gray-600" />
                        </div>
                      )}
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                          {session.user.name}
                        </h2>
                        <p className="text-gray-600">{session.user.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                          <User className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="font-medium text-gray-900">Display Name</p>
                            <p className="text-gray-600">{session.user.name || 'Not set'}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                          <Mail className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="font-medium text-gray-900">Email Address</p>
                            <p className="text-gray-600">{session.user.email}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                          <Calendar className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="font-medium text-gray-900">Member Since</p>
                            <p className="text-gray-600">
                              {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Recently'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                          <Shield className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="font-medium text-gray-900">Account Security</p>
                            <p className="text-gray-600">Google Authentication</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Shipping Address Tab */}
                {activeTab === 'shipping' && (
                  <AddressForm
                    title="Shipping Address"
                    address={shippingAddress}
                    onChange={setShippingAddress}
                  />
                )}

                {/* Billing & Payment Tab */}
                {activeTab === 'billing' && (
                  <div className="space-y-6">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="useBillingAsShipping"
                        checked={useBillingAsShipping}
                        onChange={(e) => setUseBillingAsShipping(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="useBillingAsShipping" className="text-sm font-medium text-gray-700">
                        Use shipping address as billing address
                      </label>
                    </div>

                    {!useBillingAsShipping && (
                      <AddressForm
                        title="Billing Address"
                        address={billingAddress}
                        onChange={setBillingAddress}
                      />
                    )}
                  </div>
                )}

                {/* Preferences Tab */}
                {activeTab === 'preferences' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900">Payment Preferences</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="saveCards"
                          checked={paymentPreferences.saveCards}
                          onChange={(e) => setPaymentPreferences(prev => ({ ...prev, saveCards: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="saveCards" className="text-sm font-medium text-gray-700">
                          Save payment methods for faster checkout
                        </label>
                      </div>

                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="autoFillShipping"
                          checked={paymentPreferences.autoFillShipping}
                          onChange={(e) => setPaymentPreferences(prev => ({ ...prev, autoFillShipping: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="autoFillShipping" className="text-sm font-medium text-gray-700">
                          Auto-fill shipping address at checkout
                        </label>
                      </div>

                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="autoFillBilling"
                          checked={paymentPreferences.autoFillBilling}
                          onChange={(e) => setPaymentPreferences(prev => ({ ...prev, autoFillBilling: e.target.checked }))}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="autoFillBilling" className="text-sm font-medium text-gray-700">
                          Auto-fill billing address at checkout
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save Button */}
                {activeTab !== 'account' && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <Save className="h-4 w-4" />
                      <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

interface AddressFormProps {
  title: string;
  address: Address;
  onChange: (address: Address) => void;
}

function AddressForm({ title, address, onChange }: AddressFormProps) {
  const updateAddress = (field: keyof Address, value: string) => {
    onChange({ ...address, [field]: value });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
            First Name *
          </label>
          <input
            type="text"
            id="firstName"
            value={address.firstName}
            onChange={(e) => updateAddress('firstName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
            Last Name *
          </label>
          <input
            type="text"
            id="lastName"
            value={address.lastName}
            onChange={(e) => updateAddress('lastName', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
            Company
          </label>
          <input
            type="text"
            id="company"
            value={address.company || ''}
            onChange={(e) => updateAddress('company', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="address1" className="block text-sm font-medium text-gray-700 mb-1">
            Address Line 1 *
          </label>
          <input
            type="text"
            id="address1"
            value={address.address1}
            onChange={(e) => updateAddress('address1', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="address2" className="block text-sm font-medium text-gray-700 mb-1">
            Address Line 2
          </label>
          <input
            type="text"
            id="address2"
            value={address.address2 || ''}
            onChange={(e) => updateAddress('address2', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
            City *
          </label>
          <input
            type="text"
            id="city"
            value={address.city}
            onChange={(e) => updateAddress('city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
            State/Province *
          </label>
          <input
            type="text"
            id="state"
            value={address.state}
            onChange={(e) => updateAddress('state', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-1">
            Postal Code *
          </label>
          <input
            type="text"
            id="postalCode"
            value={address.postalCode}
            onChange={(e) => updateAddress('postalCode', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
            Country *
          </label>
          <select
            id="country"
            value={address.country}
            onChange={(e) => updateAddress('country', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            value={address.phone || ''}
            onChange={(e) => updateAddress('phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}