import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { saveProductToSupabase } from '@/lib/supabase-storage';

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
    const tempProductId = uuidv4();
    
    // Create product record with metadata
    const productRecord: ProductRecord = {
      id: tempProductId, // This will be replaced by the actual ID from Supabase
      ...productData,
      imageUrl,
      createdAt: new Date().toISOString(),
      slug: productData.productName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
    };

    // Save to Supabase
    const supabaseProductData = {
      productName: productRecord.productName,
      tagline: productRecord.tagline,
      description: productRecord.description,
      keyFeatures: productRecord.keyFeatures,
      specifications: productRecord.specifications,
      pricing: productRecord.pricing,
      benefits: productRecord.benefits,
      targetAudience: productRecord.targetAudience,
      category: productRecord.category,
      categoryId: productRecord.categoryId || 'cat_electronics',
      categoryConfidence: productRecord.categoryConfidence || 0.8,
      categoryReasoning: productRecord.categoryReasoning || 'Default category assignment',
      tags: productRecord.tags,
      categoryPath: productRecord.categoryPath || productRecord.category,
      categoryMetadata: {
        level: 0,
        parentCategory: undefined,
        suggestedSubcategories: []
      },
      imageUrl: productRecord.imageUrl,
      createdAt: productRecord.createdAt,
      slug: productRecord.slug
    };
    
    // saveProductToSupabase returns the actual product ID that was used
    const actualProductId = await saveProductToSupabase(supabaseProductData);

    // No cache invalidation needed since we disabled all caching

    const response = NextResponse.json({
      success: true,
      productId: actualProductId, // Use the actual ID from Supabase
      productUrl: `/products/${actualProductId}`,
      productSlug: productRecord.slug
    });

    // Disable all caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;

  } catch (error) {
    console.error('Save product error:', error);
    return NextResponse.json({ error: 'Failed to save product' }, { status: 500 });
  }
}