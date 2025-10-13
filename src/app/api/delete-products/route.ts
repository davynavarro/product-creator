import { NextRequest, NextResponse } from 'next/server';
import { unlink, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

interface ProductIndexItem {
  id: string;
  productName: string;
  slug: string;
  category: string;
  createdAt: string;
  imageUrl: string;
  pricing: {
    currency: string;
    price: number;
  };
}

// Delete individual product
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    await deleteProduct(productId);

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
        await deleteProduct(productId);
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

async function deleteProduct(productId: string) {
  const productsDir = join(process.cwd(), 'data', 'products');
  const productFile = join(productsDir, `${productId}.json`);

  // Read product data to get image URL before deletion
  let imageUrl = '';
  try {
    const productContent = await readFile(productFile, 'utf-8');
    const productData = JSON.parse(productContent);
    imageUrl = productData.imageUrl;
  } catch (error) {
    console.warn(`Could not read product file for ${productId}:`, error);
  }

  // Delete product file
  try {
    await unlink(productFile);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`Failed to delete product file: ${error}`);
    }
  }

  // Delete associated image file
  if (imageUrl) {
    const imagePath = imageUrl.replace('/uploads/', '');
    const imageFile = join(process.cwd(), 'uploads', imagePath);
    try {
      await unlink(imageFile);
    } catch (error) {
      console.warn(`Could not delete image file ${imageFile}:`, error);
    }
  }

  // Update products index
  await updateProductsIndex(productId);
}

async function updateProductsIndex(deletedProductId: string) {
  try {
    const indexPath = join(process.cwd(), 'data', 'products', 'index.json');
    
    let productsIndex: ProductIndexItem[] = [];
    try {
      const indexContent = await readFile(indexPath, 'utf-8');
      productsIndex = JSON.parse(indexContent);
    } catch {
      // Index doesn't exist, nothing to update
      return;
    }

    // Remove the deleted product from index
    productsIndex = productsIndex.filter(product => product.id !== deletedProductId);

    await writeFile(indexPath, JSON.stringify(productsIndex, null, 2));
  } catch (error) {
    console.error('Failed to update products index after deletion:', error);
  }
}