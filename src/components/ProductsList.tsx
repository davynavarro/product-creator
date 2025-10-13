'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Check } from 'lucide-react';

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

interface ProductsListProps {
  initialProducts: ProductIndexItem[];
}

export default function ProductsList({ initialProducts }: ProductsListProps) {
  const [products, setProducts] = useState<ProductIndexItem[]>(initialProducts);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const refreshProducts = async () => {
    try {
      // Add delay and retry logic to handle caching
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        const response = await fetch(`/api/products?t=${Date.now()}&r=${Math.random()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        });
        
        if (response.ok) {
          const freshProducts = await response.json();
          setProducts(freshProducts);
          console.log('Products refreshed:', freshProducts.length);
          return;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`Refresh attempt ${attempts} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.error('Failed to refresh products after', maxAttempts, 'attempts');
    } catch (error) {
      console.error('Failed to refresh products:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/delete-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productIds: Array.from(selectedProducts),
        }),
      });

      if (response.ok) {
        // Optimistically remove from UI first
        setProducts(prev => prev.filter(p => !selectedProducts.has(p.id)));
        setSelectedProducts(new Set());
        setShowBulkDeleteConfirm(false);
        
        // Then refresh from server with a small delay to allow propagation
        setTimeout(() => {
          refreshProducts();
        }, 1000);
      } else {
        console.error('Failed to delete products');
        alert('Failed to delete some products');
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert('Failed to delete products');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Generated Products</h1>
            <p className="text-gray-600 mt-2">
              {products.length} product{products.length !== 1 ? 's' : ''} generated
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {selectedProducts.size > 0 && (
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Selected ({selectedProducts.size})</span>
              </button>
            )}
            
            <Link
              href="/"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create New Product
            </Link>
          </div>
        </div>

        {products.length > 0 && (
          <div className="mb-4 flex items-center">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedProducts.size === products.length && products.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
                Select all ({products.length})
              </span>
            </label>
          </div>
        )}

        {products.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m0 0V9a2 2 0 012-2h2m0 0V6a2 2 0 012-2h2.586a1 1 0 01.707.293l2.414 2.414A1 1 0 0016 7.414V9a2 2 0 012 2v2a2 2 0 01-2 2h-2m0 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v2a2 2 0 002 2h2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products yet</h3>
            <p className="text-gray-600 mb-6">Create your first AI-generated product page</p>
            <Link
              href="/"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="relative">
                  <div className="absolute top-2 left-2 z-10">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      {selectedProducts.has(product.id) && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </label>
                  </div>
                  
                  <Link href={`/products/${product.id}`}>
                    <div className="aspect-square relative">
                      <Image
                        src={product.imageUrl}
                        alt={product.productName}
                        fill
                        className="object-cover hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                  </Link>
                </div>
                
                <div className="p-4">
                  <Link href={`/products/${product.id}`}>
                    <h3 className="font-semibold text-gray-900 mb-2 overflow-hidden text-ellipsis hover:text-blue-600 transition-colors">
                      {product.productName}
                    </h3>
                  </Link>
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500 uppercase tracking-wide">
                      {product.category}
                    </span>
                    <span className="text-sm text-gray-400">
                      {formatDate(product.createdAt)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-900">
                      {formatPrice(product.pricing.price, product.pricing.currency)}
                    </span>
                    <Link
                      href={`/products/${product.id}`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bulk Delete Confirmation Dialog */}
        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Products</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete {selectedProducts.size} selected product{selectedProducts.size !== 1 ? 's' : ''}? This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}