export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  category?: string;
}

export interface OrderAddress {
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

export interface OrderTotals {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
}

export interface Order {
  orderId: string;
  userId: string;
  customerEmail: string;
  customerName: string;
  items: OrderItem[];
  shippingAddress: OrderAddress;
  billingAddress: OrderAddress;
  totals: OrderTotals;
  paymentIntentId: string;
  status: 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface CreateOrderRequest {
  paymentIntentId: string;
  checkoutData: {
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
    };
  };
  cartItems: Array<{
    id: string;
    productId: string;
    name: string;
    description: string;
    price: number;
    quantity: number;
    imageUrl?: string;
    category?: string;
  }>;
  totals: OrderTotals;
}

export interface OrderConfirmationResponse {
  success: boolean;
  orderId: string;
  message: string;
  order?: Order;
}