import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json();
    
    // Revalidate specific paths or all if none specified
    const pathsToRevalidate = path ? [path] : [
      '/products',
      '/api/products', 
      '/',
    ];

    for (const pathToRevalidate of pathsToRevalidate) {
      revalidatePath(pathToRevalidate);
    }

    return NextResponse.json({ 
      success: true, 
      revalidated: pathsToRevalidate,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache revalidation error:', error);
    return NextResponse.json({ error: 'Failed to revalidate cache' }, { status: 500 });
  }
}

// Allow GET requests to manually trigger cache refresh
export async function GET() {
  try {
    revalidatePath('/products');
    revalidatePath('/api/products');
    revalidatePath('/');

    return NextResponse.json({ 
      success: true, 
      message: 'Cache revalidated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache revalidation error:', error);
    return NextResponse.json({ error: 'Failed to revalidate cache' }, { status: 500 });
  }
}