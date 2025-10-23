import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { CartItem } from '@/contexts/CartContext';

interface OrderData {
  orderId: string;
  paymentIntentId: string;
  customerInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    price: number;
    currency: string;
  }>;
  totals: {
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
    currency: string;
  };
  status: 'confirmed' | 'processing' | 'shipped' | 'delivered';
  createdAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const {
      paymentIntentId,
      checkoutData,
      cartItems,
      totals,
    } = await request.json();

    if (!paymentIntentId || !checkoutData || !cartItems) {
      return NextResponse.json(
        { error: 'Missing required order data' },
        { status: 400 }
      );
    }

    // Generate order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create order record
    const orderData: OrderData = {
      orderId,
      paymentIntentId,
      customerInfo: {
        firstName: checkoutData.shipping.firstName,
        lastName: checkoutData.shipping.lastName,
        email: checkoutData.shipping.email,
        phone: checkoutData.shipping.phone,
      },
      shippingAddress: {
        address: checkoutData.shipping.address,
        city: checkoutData.shipping.city,
        state: checkoutData.shipping.state,
        zipCode: checkoutData.shipping.zipCode,
        country: checkoutData.shipping.country,
      },
      items: cartItems.map((item: CartItem) => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        currency: item.currency,
      })),
      totals: {
        subtotal: totals.subtotal,
        shipping: totals.shipping || 0,
        tax: totals.tax || 0,
        total: totals.total,
        currency: totals.currency || 'USD',
      },
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    // Save order to blob storage
    const orderBlob = await put(
      `orders/${orderId}.json`,
      JSON.stringify(orderData, null, 2),
      { 
        access: 'public',
        contentType: 'application/json' 
      }
    );

    // Update orders index
    try {
      const indexResponse = await fetch(`${process.env.BLOB_DB_URL}orders-index.json`);
      let ordersIndex = [];
      
      if (indexResponse.ok) {
        ordersIndex = await indexResponse.json();
      }

      // Add new order to index
      ordersIndex.push({
        orderId,
        customerEmail: orderData.customerInfo.email,
        customerName: `${orderData.customerInfo.firstName} ${orderData.customerInfo.lastName}`,
        total: orderData.totals.total,
        currency: orderData.totals.currency,
        status: orderData.status,
        createdAt: orderData.createdAt,
        blobUrl: orderBlob.url,
      });

      // Save updated index
      await put(
        'orders-index.json',
        JSON.stringify(ordersIndex, null, 2),
        { 
          access: 'public',
          contentType: 'application/json',
          addRandomSuffix: false,
          allowOverwrite: true
        }
      );
    } catch (indexError) {
      console.error('Failed to update orders index:', indexError);
      // Continue - order is still saved
    }

    return NextResponse.json({
      success: true,
      orderId,
      orderData,
    });
  } catch (error) {
    console.error('Error confirming order:', error);
    return NextResponse.json(
      { error: 'Failed to confirm order' },
      { status: 500 }
    );
  }
}