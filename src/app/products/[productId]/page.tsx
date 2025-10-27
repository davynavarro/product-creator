import { notFound } from 'next/navigation';
import ProductPage from '@/components/ProductPage';
import { getProductFromSupabase } from '@/lib/supabase-storage';

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
  
  // Fetch product data from API
  let product = null;
  try {
    // First try to get all products and find the specific one
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/products`, {
      cache: 'no-store'
    });
    
    if (response.ok) {
      const products: ProductIndexItem[] = await response.json();
      const productIndex = products.find((p: ProductIndexItem) => p.id === productId);
      
      if (productIndex) {
        // If we found it in the index, we need to fetch the full product data
        // For now, we'll construct a basic product object from the index
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

    // If not found in index, try direct fetch from Supabase
    // This handles the case where a product was just created and isn't in the index yet
    if (!product) {
      console.log(`Product ${productId} not found in index, trying direct fetch from Supabase...`);
      const directProduct = await getProductFromSupabase(productId);
      if (directProduct) {
        product = directProduct;
        console.log(`Product ${productId} found via direct Supabase fetch`);
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
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/products`, {
      cache: 'no-store'
    });
    
    if (response.ok) {
      const products: ProductIndexItem[] = await response.json();
      return products.map((product: ProductIndexItem) => ({
        productId: product.id,
      }));
    }
    
    return [];
  } catch {
    return [];
  }
}