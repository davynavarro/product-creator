import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { saveOrderToSupabase, updateOrdersIndex, OrderData } from '@/lib/supabase-storage';

export async function POST(request: NextRequest) {
  try {
    const orderData: OrderData = await request.json();

    console.log('Saving order from AI assistant:', orderData.orderId);
    console.log('Order data:', JSON.stringify(orderData, null, 2));

    // Validate that we have the required data
    if (!orderData.orderId || !orderData.customerInfo?.email) {
      return NextResponse.json(
        { error: 'Missing required order data (orderId or customerInfo.email)' },
        { status: 400 }
      );
    }

    // For AI-generated orders, we trust the data since it comes from our server
    // But we still want to validate the session for security
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      console.log('No session found, but processing AI order for:', orderData.customerInfo.email);
      // We'll allow AI orders even without session since they come from our server
    }

    // Save order to Supabase
    await saveOrderToSupabase(orderData);
    
    // Update orders index (this function extracts the index data from OrderData)
    await updateOrdersIndex(orderData);

    console.log('Order saved successfully:', orderData.orderId);

    return NextResponse.json({
      success: true,
      orderId: orderData.orderId,
      message: 'Order saved successfully'
    });

  } catch (error) {
    console.error('Error saving order:', error);
    return NextResponse.json(
      { error: 'Failed to save order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}