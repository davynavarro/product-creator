import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
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
  category: string; // Legacy field for backward compatibility
  categoryId?: string; // New structured category reference
  categoryPath?: string; // Full category path
  categoryConfidence?: number; // AI confidence in category selection
  categoryReasoning?: string; // AI reasoning for category choice
  categoryMetadata?: {
    confidence: number;
    reasoning: string;
    isNovelProduct?: boolean;
    assignmentMethod?: 'ai_primary' | 'fallback';
  };
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

    // Invalidate related caches to ensure fresh data
    try {
      revalidatePath('/products');
      revalidatePath('/api/products');
      revalidatePath('/');
      console.log('Cache invalidated after product save');
    } catch (revalidateError) {
      console.warn('Cache revalidation failed (non-critical):', revalidateError);
    }

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