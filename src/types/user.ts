export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface PaymentPreferences {
  defaultPaymentMethod?: 'card' | 'paypal' | 'apple_pay' | 'google_pay';
  saveCards: boolean;
  autoFillShipping: boolean;
  autoFillBilling: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  image?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  useBillingAsShipping: boolean;
  paymentPreferences: PaymentPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileFormData {
  shippingAddress: Address;
  billingAddress: Address;
  useBillingAsShipping: boolean;
  paymentPreferences: PaymentPreferences;
}

export interface SaveProfileRequest {
  profile: Partial<UserProfileFormData>;
}

export interface ProfileApiResponse {
  success: boolean;
  message: string;
  profile?: UserProfile;
}