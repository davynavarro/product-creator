import { put, list, del } from '@vercel/blob';

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

const PRODUCTS_INDEX_KEY = 'products-index.json';
const blobUrl = process.env.BLOB_DB_URL;

if (!blobUrl) {
  console.error('BLOB_DB_URL environment variable is not set');
}

// Save product data to Vercel Blob
export async function saveProductToBlob(productRecord: ProductRecord): Promise<void> {
  const productKey = `products/${productRecord.id}.json`;
  
  // Save individual product
  await put(productKey, JSON.stringify(productRecord, null, 2), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
  });

  // Update products index
  await updateProductsIndex(productRecord);
}

// Get product from Vercel Blob
export async function getProductFromBlob(productId: string): Promise<ProductRecord | null> {
  try {
    if (!blobUrl) {
      console.error('BLOB_DB_URL is not configured');
      return null;
    }

    const productKey = `products/${productId}.json`;
    const cacheBuster = `?t=${Date.now()}`;
    const response = await fetch(`${blobUrl}${productKey}${cacheBuster}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching product from blob:', error);
    return null;
  }
}

// Get all products from index
export async function getProductsFromBlob(): Promise<ProductIndexItem[]> {
  try {
    if (!blobUrl) {
      console.error('BLOB_DB_URL is not configured');
      return [];
    }

    // Add multiple cache-busting strategies
    const cacheBuster = `?t=${Date.now()}&r=${Math.random()}`;
    const url = `${blobUrl}${PRODUCTS_INDEX_KEY}${cacheBuster}`;
    console.log('Fetching products from:', url);
    
    const response = await fetch(url, {
      cache: 'no-store', // Prevent Next.js caching
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch products index:', response.status, response.statusText);
      return [];
    }
    
    const products = await response.json();
    console.log('Successfully fetched', products.length, 'products');
    return products;
  } catch (error) {
    console.error('Error fetching products index from blob:', error);
    return [];
  }
}

// Delete product from Vercel Blob
export async function deleteProductFromBlob(productId: string): Promise<void> {
  try {
    console.log('Starting deletion of product:', productId);
    
    // Get product data first to get image URL
    const product = await getProductFromBlob(productId);
    console.log('Found product to delete:', product?.productName);
    
    // Delete product JSON
    const productKey = `products/${productId}.json`;
    console.log('Deleting product file:', productKey);
    await del(productKey);

    // Delete associated image if it exists and is stored in blob
    if (product?.imageUrl && product.imageUrl.includes('vercel-storage.com')) {
      const imageKey = product.imageUrl.split('/').pop();
      if (imageKey) {
        console.log('Deleting associated image:', imageKey);
        await del(`images/${imageKey}`);
      }
    }

    // Update products index
    console.log('Updating products index to remove:', productId);
    await removeFromProductsIndex(productId);
    console.log('Product deletion completed successfully');
  } catch (error) {
    console.error('Error deleting product from blob:', error);
    throw error;
  }
}

// Upload image to Vercel Blob
export async function uploadImageToBlob(file: File): Promise<string> {
  const fileName = `${Date.now()}-${file.name}`;
  const imageKey = `images/${fileName}`;
  
  const blob = await put(imageKey, file, {
    access: 'public',
    contentType: file.type,
    allowOverwrite: true,
  });

  return blob.url;
}

// Update products index
async function updateProductsIndex(productRecord: ProductRecord): Promise<void> {
  try {
    let productsIndex: ProductIndexItem[] = await getProductsFromBlob();

    // Remove existing entry if it exists (for updates)
    productsIndex = productsIndex.filter(p => p.id !== productRecord.id);

    // Add new entry
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
    productsIndex.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Save updated index with no caching
    await put(PRODUCTS_INDEX_KEY, JSON.stringify(productsIndex, null, 2), {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true,
      cacheControlMaxAge: 0, // Disable caching
    });
    
    console.log('Products index updated successfully');
  } catch (error) {
    console.error('Failed to update products index:', error);
    throw error;
  }
}

// Remove from products index with retry logic for cache consistency
async function removeFromProductsIndex(productId: string): Promise<void> {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      let productsIndex: ProductIndexItem[] = await getProductsFromBlob();

      // Check if product is still in the index
      const productExists = productsIndex.some(p => p.id === productId);
      if (!productExists && retryCount > 0) {
        console.log('Product already removed from index');
        return;
      }

      // Remove the deleted product
      const originalLength = productsIndex.length;
      productsIndex = productsIndex.filter(p => p.id !== productId);
      
      if (productsIndex.length === originalLength) {
        console.log('Product not found in index, might already be deleted');
        return;
      }

      // Save updated index with cache-busting
      await put(PRODUCTS_INDEX_KEY, JSON.stringify(productsIndex, null, 2), {
        access: 'public',
        contentType: 'application/json',
        allowOverwrite: true,
        cacheControlMaxAge: 0, // Disable caching
      });

      console.log(`Successfully removed product ${productId} from index`);
      
      // Wait a moment for the update to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify the deletion worked
      const verifyIndex = await getProductsFromBlob();
      const stillExists = verifyIndex.some(p => p.id === productId);
      
      if (!stillExists) {
        console.log('Deletion verified successfully');
        return;
      } else {
        console.log(`Retry ${retryCount + 1}: Product still exists in index, retrying...`);
        retryCount++;
      }
      
    } catch (error) {
      console.error(`Attempt ${retryCount + 1} failed to remove from products index:`, error);
      retryCount++;
      
      if (retryCount >= maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error(`Failed to remove product ${productId} from index after ${maxRetries} attempts`);
}

// List all blobs (for debugging/admin purposes)
export async function listAllBlobs() {
  const { blobs } = await list();
  return blobs;
}