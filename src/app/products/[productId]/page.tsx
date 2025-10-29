import { notFound } from 'next/navigation';
import ProductPage from '@/components/ProductPage';
import { getProductFromSupabase } from '@/lib/supabase-storage';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

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
    originalPrice?: number;
    discount?: string;
  };
}

interface Props {
  params: Promise<{ productId: string }>;
}

export default async function ProductPageRoute({ params }: Props) {
  const { productId } = await params;
  
  // Fetch product data - always try to get full product data first
  let product = null;
  try {
    // First try to get the full product data directly from Supabase
    console.log(`Fetching full product data for ${productId}...`);
    product = await getProductFromSupabase(productId);
    
    if (product) {
      console.log(`Product ${productId} found with full data from Supabase`);
    } else {
      // If direct fetch fails, try to find it in the products index
      console.log(`Product ${productId} not found directly, checking products index...`);
      const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/products`, {
        cache: 'no-store'
      });
      
      if (response.ok) {
        const products: ProductIndexItem[] = await response.json();
        const productIndex = products.find((p: ProductIndexItem) => p.id === productId);
        
        if (productIndex) {
          // If we found it in the index but couldn't get full data, 
          // create a minimal product object to prevent 404
          console.log(`Product ${productId} found in index but full data unavailable`);
          product = {
            ...productIndex,
            tagline: 'Product tagline', // Default values since we only have index data
            description: 'Product description',
            keyFeatures: [],
            specifications: {},
            benefits: [],
            targetAudience: '',
            tags: []
          };
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch product:', error);
  }

  if (!product) {
    notFound();
  }

  // Ensure we have an imageUrl for the component
  const imageUrl = product.imageUrl || '/placeholder.svg';

  return (
    <ProductPage
      productData={product}
      imageUrl={imageUrl}
      productId={productId}
    />
  );
}

// Generate static params for all existing products
export async function generateStaticParams() {
  // During build time, we can't rely on API routes, so return empty array
  // This will make the pages dynamic instead of static
  return [];
}