import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

interface OrderSummary {
  orderId: string;
  customerEmail: string;
  customerName: string;
  total: number;
  currency: string;
  status: string;
  createdAt: string;
  blobUrl?: string;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;

    try {
      // Fetch orders index from blob storage
      const indexResponse = await fetch(`${process.env.BLOB_DB_URL}orders-index.json`);
      
      if (!indexResponse.ok) {
        console.log('No orders index found, returning empty array');
        return NextResponse.json([]);
      }

      const allOrders: OrderSummary[] = await indexResponse.json();
      
      // Filter orders by user email
      const userOrders = allOrders.filter(order => 
        order.customerEmail === userEmail
      );

      // Sort by creation date (newest first)
      userOrders.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return NextResponse.json(userOrders);
    } catch (fetchError) {
      console.error('Error fetching orders from blob storage:', fetchError);
      // Return empty array instead of error to gracefully handle missing data
      return NextResponse.json([]);
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}