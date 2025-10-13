'use client';

import Image from 'next/image';
import { ShoppingCart, Heart, Share2, ArrowLeft, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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

interface ProductPageProps {
  productData: ProductData;
  imageUrl: string;
  productId?: string;
  onBack?: () => void;
}

export default function ProductPage({ productData, imageUrl, productId, onBack }: ProductPageProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push('/');
    }
  };

  const handleDelete = async () => {
    if (!productId) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/delete-products?id=${productId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/products');
      } else {
        console.error('Failed to delete product');
        alert('Failed to delete product');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete product');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };
  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <button
              onClick={handleBack}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Builder</span>
            </button>
            
            {productId && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center space-x-2 text-red-600 hover:text-red-700 transition-colors px-3 py-1 rounded-md border border-red-300 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Product</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-square relative bg-white rounded-lg overflow-hidden shadow-lg">
              <Image
                src={imageUrl}
                alt={productData.productName}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Category & Title */}
            <div>
              <div className="text-sm text-gray-500 uppercase tracking-wide font-medium mb-2">
                {productData.category}
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                {productData.productName}
              </h1>
              <p className="text-lg text-gray-600">{productData.tagline}</p>
            </div>

            {/* Pricing */}
            <div className="space-y-2">
              <div className="flex items-baseline space-x-3">
                <span className="text-3xl font-bold text-gray-900">
                  {formatPrice(productData.pricing.price, productData.pricing.currency)}
                </span>
              </div>
            </div>

            {/* Add to Cart */}
            <div className="flex space-x-4">
              <button className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2">
                <ShoppingCart className="h-5 w-5" />
                <span>Add to Cart</span>
              </button>
              <button className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Heart className="h-5 w-5 text-gray-600" />
              </button>
              <button className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Share2 className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Key Features */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Features</h3>
              <ul className="space-y-2">
                {productData.keyFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Benefits */}
            {productData.benefits && productData.benefits.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Benefits</h3>
                <ul className="space-y-2">
                  {productData.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <div className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                      <span className="text-gray-700">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Description</h2>
            <div className="prose prose-gray max-w-none">
              {productData.description.split('\n').map((paragraph, index) => (
                <p key={index} className="text-gray-700 leading-relaxed mb-4">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Target Audience */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Perfect For</h3>
              <p className="text-gray-700">{productData.targetAudience}</p>
            </div>
          </div>

          {/* Specifications */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Specifications</h2>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <dl className="space-y-4">
                {Object.entries(productData.specifications).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-sm font-medium text-gray-500">{key}</dt>
                    <dd className="text-sm text-gray-900 mt-1">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Tags */}
            {productData.tags && productData.tags.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {productData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Product</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete &ldquo;{productData.productName}&rdquo;? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
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
  );
}