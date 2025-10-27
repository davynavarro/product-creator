import { NextResponse } from 'next/server';
import { getProductsFromSupabase } from '@/lib/supabase-storage';

export async function GET() {
  try {
    const products = await getProductsFromSupabase();
    
    // Return products with no cache headers
    const response = NextResponse.json(products);
    
    // Disable all caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    
    return response;
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json([], { status: 500 });
  }
}