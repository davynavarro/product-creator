import { NextRequest, NextResponse } from 'next/server';
import { saveOrderToSupabase, OrderData, updateOrdersIndex } from '@/lib/supabase-storage';
import { CartItem } from '@/contexts/CartContext';

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

    // Save order data to Supabase
    try {
      await saveOrderToSupabase(orderData);
      console.log('Order saved to Supabase successfully:', orderData.orderId);
    } catch (saveError) {
      console.error('Failed to save order to Supabase:', saveError);
      throw new Error('Order save failed');
    }    // Update orders index in Supabase
    try {
      await updateOrdersIndex(orderData);
      console.log('Orders index updated successfully');
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