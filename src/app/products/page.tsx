import ProductsList from '@/components/ProductsList';

// Disable all caching for this page
export const dynamic = 'force-dynamic';
export const revalidate = 0; // No revalidation caching

export default async function ProductsPage() {
  // Don't fetch products server-side, let the component handle it entirely on client-side
  // This eliminates any server-side caching issues
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">All Products</h1>
          <p className="mt-2 text-gray-600">
            Browse and manage your AI-generated product pages
          </p>
        </div>
        <ProductsList initialProducts={[]} />
      </div>
    </div>
  );
}