import { NextRequest, NextResponse } from 'next/server';
import { deleteProductFromBlob } from '@/lib/blob-storage';

// Delete individual product
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    await deleteProductFromBlob(productId);

    return NextResponse.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}

// Bulk delete products
export async function POST(request: NextRequest) {
  try {
    const { productIds } = await request.json();

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Product IDs array is required' }, { status: 400 });
    }

    const results = [];
    for (const productId of productIds) {
      try {
        await deleteProductFromBlob(productId);
        results.push({ id: productId, success: true });
      } catch (error) {
        console.error(`Failed to delete product ${productId}:`, error);
        results.push({ id: productId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Deleted ${successCount} products successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      results
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return NextResponse.json({ error: 'Failed to delete products' }, { status: 500 });
  }
}