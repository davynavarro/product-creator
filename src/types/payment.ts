export interface SavedPaymentMethod {
  id: string;
  type: 'card';
  card: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
  isDefault: boolean;
}

export interface PaymentMethodsResponse {
  success: boolean;
  paymentMethods: SavedPaymentMethod[];
  defaultPaymentMethod: string | null;
}

export interface SavePaymentMethodRequest {
  paymentMethodId: string;
  setAsDefault?: boolean;
}

export interface SavePaymentMethodResponse {
  success: boolean;
  message: string;
  paymentMethod: SavedPaymentMethod;
  customerId: string;
}

export interface SetupIntentResponse {
  success: boolean;
  clientSecret: string;
  customerId: string;
}

export interface DeletePaymentMethodResponse {
  success: boolean;
  message: string;
}

export interface UpdatePaymentMethodRequest {
  setAsDefault?: boolean;
}

export interface UpdatePaymentMethodResponse {
  success: boolean;
  message: string;
}