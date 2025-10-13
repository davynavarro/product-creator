import { NextResponse } from 'next/server';
import { getProductsFromBlob } from '@/lib/blob-storage';

export async function GET() {
  try {
    const products = await getProductsFromBlob();
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json([], { status: 500 });
  }
}