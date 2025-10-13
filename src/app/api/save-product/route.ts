import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

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

interface ProductIndexItem {
  id: string;
  productName: string;
  slug: string;
  category: string;
  createdAt: string;
  imageUrl: string;
  pricing: ProductData['pricing'];
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

    // Ensure products directory exists
    const productsDir = join(process.cwd(), 'data', 'products');
    
    try {
      await writeFile(join(productsDir, '.gitkeep'), '');
    } catch {
      // Directory might not exist, will be created by writeFile
    }

    // Save product data to JSON file
    const filePath = join(productsDir, `${productId}.json`);
    await writeFile(filePath, JSON.stringify(productRecord, null, 2));

    // Update products index
    await updateProductsIndex(productRecord);

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

async function updateProductsIndex(productRecord: ProductRecord) {
  try {
    const indexPath = join(process.cwd(), 'data', 'products', 'index.json');
    
    let productsIndex: ProductIndexItem[] = [];
    try {
      const indexContent = await readFile(indexPath, 'utf-8');
      productsIndex = JSON.parse(indexContent);
    } catch {
      // Index doesn't exist yet, start with empty array
    }

    // Add new product to index
    const indexItem: ProductIndexItem = {
      id: productRecord.id,
      productName: productRecord.productName,
      slug: productRecord.slug,
      category: productRecord.category,
      createdAt: productRecord.createdAt,
      imageUrl: productRecord.imageUrl,
      pricing: productRecord.pricing
    };

    productsIndex.push(indexItem);

    // Sort by creation date (newest first)
    productsIndex.sort((a: ProductIndexItem, b: ProductIndexItem) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    await writeFile(indexPath, JSON.stringify(productsIndex, null, 2));
  } catch (error) {
    console.error('Failed to update products index:', error);
  }
}