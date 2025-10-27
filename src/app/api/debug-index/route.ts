import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase.storage
      .from('products')
      .download('products-index.json');
    
    if (error || !data) {
      return NextResponse.json({ 
        error: 'Failed to fetch products index', 
        details: error 
      }, { status: 500 });
    }
    
    const text = await data.text();
    const products = JSON.parse(text);
    
    return NextResponse.json({
      success: true,
      indexContent: products,
      productCount: products.length,
      rawText: text
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Error reading products index', 
      details: error 
    }, { status: 500 });
  }
}