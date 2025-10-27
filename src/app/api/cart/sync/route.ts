import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// API endpoint to sync server cart with client cart
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { clientCart } = await request.json();
    
    if (!Array.isArray(clientCart)) {
      return NextResponse.json({ error: 'Invalid client cart data' }, { status: 400 });
    }

    const userEmail = session.user.email;

    // Get server cart
    const serverCartResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/cart?sessionId=${userEmail}`);
    const serverCartData = serverCartResponse.ok ? await serverCartResponse.json() : { items: [] };
    const serverItems = serverCartData.items || [];

    // Merge carts: combine items by ID, summing quantities
    const mergedItems = [...clientCart];
    
    for (const serverItem of serverItems) {
      const existingIndex = mergedItems.findIndex(item => item.id === serverItem.id);
      if (existingIndex >= 0) {
        // Item exists in both carts, sum the quantities
        mergedItems[existingIndex].quantity += serverItem.quantity;
      } else {
        // Item only exists in server cart, add it
        mergedItems.push(serverItem);
      }
    }

    // Save merged cart back to server
    const saveResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: userEmail,
        items: mergedItems
      })
    });

    if (!saveResponse.ok) {
      return NextResponse.json({ error: 'Failed to save merged cart' }, { status: 500 });
    }

    const response = NextResponse.json({
      success: true,
      mergedCart: mergedItems,
      message: 'Carts synchronized successfully'
    });

    // Disable all caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;

  } catch (error) {
    console.error('Cart sync error:', error);
    return NextResponse.json({ error: 'Failed to sync carts' }, { status: 500 });
  }
}

// GET endpoint to retrieve server cart for logged-in user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userEmail = session.user.email;

    // Get server cart
    const serverCartResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/cart?sessionId=${userEmail}`);
    
    if (!serverCartResponse.ok) {
      const response = NextResponse.json({ items: [], totalItems: 0, totalAmount: 0 });
      // Disable all caching
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      response.headers.set('Surrogate-Control', 'no-store');
      return response;
    }

    const serverCartData = await serverCartResponse.json();
    const response = NextResponse.json(serverCartData);

    // Disable all caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;

  } catch (error) {
    console.error('Error fetching server cart:', error);
    return NextResponse.json({ error: 'Failed to fetch server cart' }, { status: 500 });
  }
}