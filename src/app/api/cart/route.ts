import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { CartItem, getCartFromSupabase, saveCartToSupabase, deleteCartFromSupabase } from '@/lib/supabase-storage';

export const runtime = 'nodejs';

// GET /api/cart - Get cart items for authenticated user
export async function GET() {
  try {
    // Get authenticated session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Use email from authenticated session as cart identifier
    const userEmail = session.user.email;
    const cartItems = await getCartFromSupabase(userEmail);
    
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

// POST /api/cart - Save cart items for authenticated user
export async function POST(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { items } = body; // sessionId no longer needed - use auth
    
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

    // Use email from authenticated session
    const userEmail = session.user.email;
    await saveCartToSupabase(userEmail, items);
    
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

// DELETE /api/cart - Clear cart for authenticated user
export async function DELETE(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { items } = body; // sessionId no longer needed - use auth
    
    const userEmail = session.user.email;
    let response;
    
    if(items && items.length > 0 ) {
      await deleteCartFromSupabase(userEmail, items);
      response = NextResponse.json({
        success: true,
        message: 'Items removed from cart successfully',
      });
    } else {
      await deleteCartFromSupabase(userEmail);
      response = NextResponse.json({
        success: true,
        message: 'Cart cleared successfully',
      });
    }

  

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