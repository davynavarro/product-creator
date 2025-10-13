import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { saveProductToBlob } from '@/lib/blob-storage';

interface ProductData {
  productName: string;
  tagline: string;
  description: string;
  keyFeatures: string[];
  specifications: Record<string, string>;
  pricing: {
    currency: string;
    price: number;
    originalPrice?: number;
    discount?: string;
  };
  benefits: string[];
  targetAudience: string;
  category: string;
  tags: string[];
}

interface ProductRecord extends ProductData {
  id: string;
  imageUrl: string;
  createdAt: string;
  slug: string;
}

export async function POST(request: NextRequest) {
  try {
    const { productData, imageUrl } = await request.json();

    if (!productData) {
      return NextResponse.json({ error: 'Product data is required' }, { status: 400 });
    }

    // Generate unique product ID
    const productId = uuidv4();
    
    // Create product record with metadata
    const productRecord: ProductRecord = {
      id: productId,
      ...productData,
      imageUrl,
      createdAt: new Date().toISOString(),
      slug: productData.productName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
    };

    // Save to Vercel Blob
    await saveProductToBlob(productRecord);

    return NextResponse.json({
      success: true,
      productId,
      productUrl: `/products/${productId}`,
      productSlug: productRecord.slug
    });

  } catch (error) {
    console.error('Save product error:', error);
    return NextResponse.json({ error: 'Failed to save product' }, { status: 500 });
  }
}