import { NextResponse } from 'next/server';
import { getProductsFromBlob } from '@/lib/blob-storage';

export async function GET() {
  try {
    const products = await getProductsFromBlob();
    
    // Return products with appropriate cache headers
    const response = NextResponse.json(products);
    
    // Allow caching but ensure fresh data when products change
    response.headers.set('Cache-Control', 'public, max-age=60, must-revalidate');
    response.headers.set('Vary', 'Accept');
    
    return response;
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json([], { status: 500 });
  }
}