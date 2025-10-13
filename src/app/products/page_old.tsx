import { readFile } from 'fs/promises';
import { join } from 'path';
import Link from 'next/link';
import Image from 'next/image';

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

async function getProducts(): Promise<ProductIndexItem[]> {
  try {
    const indexPath = join(process.cwd(), 'data', 'products', 'index.json');
    const indexContent = await readFile(indexPath, 'utf-8');
    return JSON.parse(indexContent);
  } catch {
    return [];
  }
}

export default async function ProductsPage() {
  const products = await getProducts();

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Generated Products</h1>
              <p className="text-gray-600 mt-2">
                Browse all AI-generated product pages
              </p>
            </div>
            <Link
              href="/"
              className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
            >
              Create New Product
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-400 text-lg mb-4">No products generated yet</div>
            <Link
              href="/"
              className="inline-flex items-center bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
            >
              Generate Your First Product
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="aspect-square relative">
                  <Image
                    src={product.imageUrl}
                    alt={product.productName}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    {product.category}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2 overflow-hidden text-ellipsis">
                    {product.productName}
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-900">
                        {formatPrice(product.pricing.price, product.pricing.currency)}
                      </span>
                      {product.pricing.originalPrice && (
                        <span className="text-sm text-gray-500 line-through">
                          {formatPrice(product.pricing.originalPrice, product.pricing.currency)}
                        </span>
                      )}
                    </div>
                    {product.pricing.discount && (
                      <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded">
                        {product.pricing.discount}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Created {formatDate(product.createdAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}