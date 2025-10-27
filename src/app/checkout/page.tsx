'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useCart } from '@/contexts/CartContext';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, CreditCard, Truck, User } from 'lucide-react';
import Image from 'next/image';
import ShippingForm from '@/components/checkout/ShippingForm';
import SavedPaymentMethodForm from '@/components/checkout/SavedPaymentMethodForm';
import OrderReview from '@/components/checkout/OrderReview';
import { UserProfile } from '@/types/user';

type CheckoutStep = 'shipping' | 'payment' | 'review';

interface CheckoutData {
  shipping: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  payment: {
    selectedPaymentMethodId?: string;
    billingAddress: {
      sameAsShipping: boolean;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  };
}

export default function CheckoutPage() {
  const { state } = useCart();
  const { data: session } = useSession();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('shipping');
  const [paymentData, setPaymentData] = useState<{ paymentMethodId?: string; orderId?: string; [key: string]: unknown } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutData>({
    shipping: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US',
    },
    payment: {
      billingAddress: {
        sameAsShipping: true,
      },
    },
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Load user profile for auto-fill
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!session?.user?.email || profileLoaded) return;
      
      try {
        setProfileLoading(true);
        const response = await fetch('/api/profile');
        const data = await response.json();
        
        if (data.success && data.profile) {
          setUserProfile(data.profile);
          
          // Auto-fill shipping information if available and user preference allows
          if (data.profile.shippingAddress && data.profile.paymentPreferences.autoFillShipping) {
            const addr = data.profile.shippingAddress;
            setCheckoutData(prev => ({
              ...prev,
              shipping: {
                firstName: addr.firstName || '',
                lastName: addr.lastName || '',
                email: session.user?.email || '',
                phone: addr.phone || '',
                address: addr.address1 || '',
                city: addr.city || '',
                state: addr.state || '',
                zipCode: addr.postalCode || '',
                country: addr.country || 'US',
              },
            }));
          }
        }
        setProfileLoaded(true);
      } catch (error) {
        console.error('Error loading profile:', error);
        setProfileLoaded(true);
      } finally {
        setProfileLoading(false);
      }
    };

    loadUserProfile();
  }, [session, profileLoaded]);

  // Redirect if cart is empty
  useEffect(() => {
    if (!state.isLoading && state.items.length === 0) {
      router.push('/cart');
    }
  }, [state.isLoading, state.items.length, router]);

  const steps = [
    { id: 'shipping', name: 'Shipping', icon: Truck },
    { id: 'payment', name: 'Payment', icon: CreditCard },
    { id: 'review', name: 'Review', icon: CheckCircle },
  ];

  const handleStepChange = (step: CheckoutStep) => {
    setCurrentStep(step);
  };

  const handleDataUpdate = (section: keyof CheckoutData, data: Partial<CheckoutData[keyof CheckoutData]>) => {
    setCheckoutData(prev => ({
      ...prev,
      [section]: { ...prev[section], ...data },
    }));
  };

  const handlePlaceOrder = async () => {
    if (!paymentData?.paymentMethodId) {
      alert('Payment method is missing. Please go back and select a payment method.');
      return;
    }

    setIsProcessing(true);
    try {
      // Process payment using the selected saved payment method
      const response = await fetch('/api/direct-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cartItems: state.items,
          shippingInfo: {
            firstName: checkoutData.shipping.firstName,
            lastName: checkoutData.shipping.lastName,
            address: checkoutData.shipping.address,
            city: checkoutData.shipping.city,
            state: checkoutData.shipping.state,
            zipCode: checkoutData.shipping.zipCode,
            country: checkoutData.shipping.country,
            phone: checkoutData.shipping.phone,
          },
          paymentMethodId: paymentData.paymentMethodId,
          orderNote: 'Order placed via checkout page'
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to success page (cart will be cleared there)
        router.push(`/checkout/success?orderId=${result.orderId}`);
      } else {
        throw new Error(result.error || 'Payment failed');
      }
    } catch (error) {
      console.error('Order placement failed:', error);
      alert(`Order placement failed: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (state.items.length === 0) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => router.push('/cart')}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors mr-4"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Cart
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : isActive
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium ${
                      isCompleted || isActive ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {step.name}
                  </span>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-16 h-0.5 mx-4 ${
                        isCompleted ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Checkout Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {currentStep === 'shipping' && (
              <div className="space-y-4">
                {/* Profile Auto-fill Indicator */}
                {session && userProfile && userProfile.paymentPreferences.autoFillShipping && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <User className="h-5 w-5 text-blue-600 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          Information pre-filled from your profile
                        </p>
                        <p className="text-sm text-blue-700">
                          You can edit these details or{' '}
                          <button
                            onClick={() => router.push('/profile')}
                            className="underline hover:no-underline"
                          >
                            update your profile
                          </button>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {profileLoading && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
                      <p className="text-sm text-gray-700">Loading your saved information...</p>
                    </div>
                  </div>
                )}

                <ShippingForm
                  data={checkoutData.shipping}
                  onUpdate={(data) => handleDataUpdate('shipping', data)}
                  onNext={() => handleStepChange('payment')}
                />
              </div>
            )}
            
            {currentStep === 'payment' && (
              <SavedPaymentMethodForm
                data={checkoutData.payment}
                onUpdate={(data) => handleDataUpdate('payment', data)}
                onNext={(paymentInfo) => {
                  if (paymentInfo) {
                    setPaymentData(paymentInfo);
                  }
                  handleStepChange('review');
                }}
                onBack={() => handleStepChange('shipping')}
                totalAmount={state.totalAmount}
              />
            )}
            
            {currentStep === 'review' && (
              <OrderReview
                checkoutData={checkoutData}
                cartItems={state.items}
                onPlaceOrder={handlePlaceOrder}
                onBack={() => handleStepChange('payment')}
                isProcessing={isProcessing}
              />
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>
              
              <div className="space-y-3 mb-4">
                {state.items.map((item) => (
                  <div key={`${item.id}-${JSON.stringify(item.variant || {})}`} className="flex gap-3">
                    <Image
                      src={item.imageUrl}
                      alt={item.productName}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-lg object-cover bg-gray-100"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.productName}
                      </p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">${state.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">
                    {state.totalAmount > 50 ? (
                      <span className="text-green-600">Free</span>
                    ) : (
                      '$9.99'
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">${(state.totalAmount * 0.08).toFixed(2)}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-gray-900">Total</span>
                    <span className="text-lg font-bold text-blue-600">
                      ${(state.totalAmount + (state.totalAmount > 50 ? 0 : 9.99) + (state.totalAmount * 0.08)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}