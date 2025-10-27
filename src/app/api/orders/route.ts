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
    console.log('Fetching orders for user:', userEmail);

    try {
      // Fetch orders from Supabase
      const allOrders: OrderIndexItem[] = await getOrdersFromSupabase();
      console.log('Total orders found:', allOrders.length);
      console.log('All orders:', allOrders.map(o => ({ orderId: o.orderId, customerEmail: o.customerEmail })));
      
      // Filter orders by user email
      console.log('Filtering orders for user email:', userEmail);
      console.log('Order emails in database:', allOrders.map(o => o.customerEmail));
      
      const userOrders = allOrders.filter(order => {
        const match = order.customerEmail === userEmail;
        console.log(`Comparing "${order.customerEmail}" === "${userEmail}": ${match}`);
        return match;
      });
      console.log('User orders found:', userOrders.length);
      console.log('Filtered user orders:', userOrders);

      // Sort by creation date (newest first)
      userOrders.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const response = NextResponse.json(userOrders);

      // Disable all caching to ensure fresh order data
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      response.headers.set('Surrogate-Control', 'no-store');

      return response;
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