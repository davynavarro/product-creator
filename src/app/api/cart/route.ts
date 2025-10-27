import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { CartItem, getCartFromSupabase, saveCartToSupabase, deleteCartFromSupabase } from '@/lib/supabase-storage';

export const runtime = 'nodejs';

// GET /api/cart - Get cart items for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }
    
    const cartItems = await getCartFromSupabase(sessionId);
    
    const response = NextResponse.json({
      success: true,
      items: cartItems,
      totalItems: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    });

    // Disable all caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;
    
  } catch (error) {
    console.error('Error in GET /api/cart:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cart' },
      { status: 500 }
    );
  }
}

// POST /api/cart - Save cart items for a session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, items } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }
    
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items must be an array' },
        { status: 400 }
      );
    }
    
    // Validate cart items structure
    for (const item of items) {
      if (!item.id || !item.productName || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
        return NextResponse.json(
          { error: 'Invalid cart item structure' },
          { status: 400 }
        );
      }
    }

    
    await saveCartToSupabase(sessionId, items);
    
    const response = NextResponse.json({
      success: true,
      message: 'Cart saved successfully',
      totalItems: items.reduce((sum: number, item: CartItem) => sum + item.quantity, 0),
    });

    // Disable all caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;
    
  } catch (error) {
    console.error('Error in POST /api/cart:', error);
    return NextResponse.json(
      { error: 'Failed to save cart' },
      { status: 500 }
    );
  }
}

// DELETE /api/cart - Clear cart for a session
export async function DELETE() {
  try {
    // Get session from NextAuth (like sync endpoint does)
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const sessionId = session.user.email;
    await deleteCartFromSupabase(sessionId);
    
    const response = NextResponse.json({
      success: true,
      message: 'Cart cleared successfully',
    });

    // Disable all caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;
    
  } catch (error) {
    console.error('Error in DELETE /api/cart:', error);
    return NextResponse.json(
      { error: 'Failed to clear cart' },
      { status: 500 }
    );
  }
}