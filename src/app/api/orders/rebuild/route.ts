import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin, BUCKETS, OrderData, OrderIndexItem } from '@/lib/supabase-storage';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Rebuilding orders index...');

    // List all files in the orders bucket
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from(BUCKETS.ORDERS)
      .list();

    if (listError) {
      console.error('Error listing orders:', listError);
      return NextResponse.json({ 
        error: 'Failed to list orders',
        details: listError.message 
      }, { status: 500 });
    }

    console.log(`Found ${files?.length || 0} files in orders bucket`);

    const orderIndexItems: OrderIndexItem[] = [];

    // Process each order file
    for (const file of files || []) {
      if (file.name.endsWith('.json') && file.name !== 'orders-index.json') {
        try {
          console.log(`Processing order file: ${file.name}`);
          
          const { data: orderData } = await supabaseAdmin.storage
            .from(BUCKETS.ORDERS)
            .download(file.name);
          
          if (orderData) {
            const text = await orderData.text();
            const order: OrderData = JSON.parse(text);
            
            const orderIndexItem: OrderIndexItem = {
              orderId: order.orderId,
              customerEmail: order.customerInfo.email,
              customerName: `${order.customerInfo.firstName} ${order.customerInfo.lastName}`,
              total: order.totals.total,
              currency: order.totals.currency,
              status: order.status,
              createdAt: order.createdAt,
              userId: order.userId
            };
            
            orderIndexItems.push(orderIndexItem);
          }
        } catch (err) {
          console.error(`Error processing order file ${file.name}:`, err);
        }
      }
    }

    // Sort by creation date (newest first)
    orderIndexItems.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Save the rebuilt index
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKETS.ORDERS)
      .upload('orders-index.json', JSON.stringify(orderIndexItems, null, 2), {
        contentType: 'application/json',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading rebuilt index:', uploadError);
      return NextResponse.json({ 
        error: 'Failed to save rebuilt index',
        details: uploadError.message 
      }, { status: 500 });
    }

    console.log(`Successfully rebuilt orders index with ${orderIndexItems.length} orders`);

    return NextResponse.json({
      success: true,
      message: `Orders index rebuilt with ${orderIndexItems.length} orders`,
      orders: orderIndexItems
    });

  } catch (error) {
    console.error('Error rebuilding orders index:', error);
    return NextResponse.json(
      { 
        error: 'Failed to rebuild orders index',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}