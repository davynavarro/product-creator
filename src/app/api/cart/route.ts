import { NextRequest, NextResponse } from 'next/server';
import { put, list, del } from '@vercel/blob';
import { CartItem } from '@/contexts/CartContext';

export const runtime = 'nodejs';

// Cart session storage in blob (for future server-side sync)
function getCartSessionKey(sessionId: string): string {
  return `carts/${sessionId}.json`;
}

async function getCartFromBlob(sessionId: string): Promise<CartItem[]> {
  try {
    const key = getCartSessionKey(sessionId);
    const blobs = await list({ prefix: key });
    
    if (blobs.blobs.length === 0) {
      return [];
    }
    
    const response = await fetch(blobs.blobs[0].url);
    if (!response.ok) {
      return [];
    }
    
    const cartData = await response.json();
    return Array.isArray(cartData) ? cartData : [];
  } catch (error) {
    console.error('Error fetching cart from blob:', error);
    return [];
  }
}

async function saveCartToBlob(sessionId: string, cartItems: CartItem[]): Promise<void> {
  try {
    const key = getCartSessionKey(sessionId);
    const blob = await put(key, JSON.stringify(cartItems), {
      access: 'public',
      contentType: 'application/json',
    });
    
    console.log('Cart saved to blob:', blob.url);
  } catch (error) {
    console.error('Error saving cart to blob:', error);
    throw error;
  }
}

async function deleteCartFromBlob(sessionId: string): Promise<void> {
  try {
    const key = getCartSessionKey(sessionId);
    const blobs = await list({ prefix: key });
    
    for (const blob of blobs.blobs) {
      await del(blob.url);
    }
  } catch (error) {
    console.error('Error deleting cart from blob:', error);
    throw error;
  }
}

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
    
    const cartItems = await getCartFromBlob(sessionId);
    
    return NextResponse.json({
      success: true,
      items: cartItems,
      totalItems: cartItems.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    });
    
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
    
    await saveCartToBlob(sessionId, items);
    
    return NextResponse.json({
      success: true,
      message: 'Cart saved successfully',
      totalItems: items.reduce((sum: number, item: CartItem) => sum + item.quantity, 0),
    });
    
  } catch (error) {
    console.error('Error in POST /api/cart:', error);
    return NextResponse.json(
      { error: 'Failed to save cart' },
      { status: 500 }
    );
  }
}

// DELETE /api/cart - Clear cart for a session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }
    
    await deleteCartFromBlob(sessionId);
    
    return NextResponse.json({
      success: true,
      message: 'Cart cleared successfully',
    });
    
  } catch (error) {
    console.error('Error in DELETE /api/cart:', error);
    return NextResponse.json(
      { error: 'Failed to clear cart' },
      { status: 500 }
    );
  }
}