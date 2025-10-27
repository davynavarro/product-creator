import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getOrdersFromSupabase, OrderIndexItem } from '@/lib/supabase-storage';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;

    try {
      // Fetch orders from Supabase
      const allOrders: OrderIndexItem[] = await getOrdersFromSupabase();
      
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
      console.error('Error fetching orders from Supabase:', fetchError);
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