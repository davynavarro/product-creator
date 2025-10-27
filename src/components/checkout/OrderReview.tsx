'use client';

import { ArrowLeft } from 'lucide-react';
import { CartItem } from '@/contexts/CartContext';
import { calculateOrderTotals } from '@/lib/order-calculations';
import Image from 'next/image';

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

interface OrderReviewProps {
  checkoutData: CheckoutData;
  cartItems: CartItem[];
  onPlaceOrder: () => void;
  onBack: () => void;
  isProcessing: boolean;
}

export default function OrderReview({
  checkoutData,
  cartItems,
  onPlaceOrder,
  onBack,
  isProcessing,
}: OrderReviewProps) {
  const orderTotals = calculateOrderTotals(cartItems);

  const { shipping: shippingInfo, payment: paymentInfo } = checkoutData;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Review Your Order</h2>
      
      <div className="space-y-6">
        {/* Order Items */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Order Items</h3>
          <div className="space-y-3">
            {cartItems.map((item) => (
              <div
                key={`${item.id}-${JSON.stringify(item.variant || {})}`}
                className="flex gap-4 p-4 bg-gray-50 rounded-lg"
              >
                <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={item.imageUrl}
                    alt={item.productName}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900">{item.productName}</h4>
                  <p className="text-sm text-gray-500">{item.category}</p>
                  {item.variant && Object.keys(item.variant).length > 0 && (
                    <div className="flex gap-2 mt-1">
                      {Object.entries(item.variant).map(([key, value]) => value && (
                        <span key={key} className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-gray-600 mt-1">Quantity: {item.quantity}</p>
                </div>
                
                <div className="text-right">
                  <div className="font-medium text-gray-900">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                  {item.quantity > 1 && (
                    <div className="text-sm text-gray-500">
                      ${item.price.toFixed(2)} each
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shipping Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Shipping Information</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-medium text-gray-900">
              {shippingInfo.firstName} {shippingInfo.lastName}
            </p>
            <p className="text-gray-600">{shippingInfo.email}</p>
            {shippingInfo.phone && (
              <p className="text-gray-600">{shippingInfo.phone}</p>
            )}
            <div className="mt-2 text-gray-600">
              <p>{shippingInfo.address}</p>
              <p>
                {shippingInfo.city}, {shippingInfo.state} {shippingInfo.zipCode}
              </p>
              <p>{shippingInfo.country}</p>
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Information</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-8 h-6 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">CARD</span>
              </div>
              <span className="font-medium text-gray-900">
                {paymentInfo.selectedPaymentMethodId ? 'Saved Payment Method' : 'Payment Method'}
              </span>
            </div>
            <p className="text-gray-600 mt-1">Using saved payment method</p>
            <p className="text-gray-600">Secure payment processing via Stripe</p>
          </div>
        </div>

        {/* Billing Address */}
        {!paymentInfo.billingAddress.sameAsShipping && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Billing Address</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-gray-600">
                <p>{paymentInfo.billingAddress.address}</p>
                <p>
                  {paymentInfo.billingAddress.city}, {paymentInfo.billingAddress.state} {paymentInfo.billingAddress.zipCode}
                </p>
                <p>{paymentInfo.billingAddress.country}</p>
              </div>
            </div>
          </div>
        )}

        {/* Order Total */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Order Total</h3>
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">${orderTotals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Shipping</span>
              <span className="font-medium">
                {orderTotals.shipping === 0 ? (
                  <span className="text-green-600">Free</span>
                ) : (
                  `$${orderTotals.shipping.toFixed(2)}`
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tax</span>
              <span className="font-medium">${orderTotals.tax.toFixed(2)}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-lg font-bold text-blue-600">
                  ${orderTotals.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            By placing this order, you agree to our{' '}
            <a href="#" className="underline hover:text-blue-900">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="underline hover:text-blue-900">
              Privacy Policy
            </a>
            . Your payment information is processed securely.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={onBack}
            disabled={isProcessing}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Payment
          </button>
          
          <button
            onClick={onPlaceOrder}
            disabled={isProcessing}
            className="flex items-center gap-2 bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing Order...
              </>
            ) : (
              <>
                Place Order - ${orderTotals.total.toFixed(2)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}