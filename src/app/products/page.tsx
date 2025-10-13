import ProductsList from '@/components/ProductsList';
import { getProductsFromBlob } from '@/lib/blob-storage';

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

// Disable caching for this page
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProductsPage() {
  let products: ProductIndexItem[] = [];
  
  try {
    console.log('ProductsPage: Fetching products...');
    products = await getProductsFromBlob();
    console.log('ProductsPage: Fetched', products.length, 'products:', products.map(p => p.id));
  } catch (error) {
    console.error('Failed to fetch products:', error);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">All Products</h1>
          <p className="mt-2 text-gray-600">
            Browse and manage your AI-generated product pages
          </p>
        </div>
        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No products found.</p>
            <p className="text-gray-400 mt-2">Create your first product to get started!</p>
          </div>
        ) : (
          <ProductsList initialProducts={products} />
        )}
      </div>
    </div>
  );
}