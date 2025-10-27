'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Check, Search, X } from 'lucide-react';
import { SimpleCategorySelect } from './CategorySelector';
import AddToCartButton from '@/components/cart/AddToCartButton';

interface ProductIndexItem {
  id: string;
  productName: string;
  slug: string;
  category: string; // Legacy field for backward compatibility
  categoryId?: string; // New structured category reference
  categoryPath?: string; // Full category path (e.g., "Electronics > Smartphones")
  createdAt: string;
  imageUrl: string;
  pricing: {
    currency: string;
    price: number;
    originalPrice?: number;
    discount?: string;
  };
}

interface SearchState {
  searchTerm: string;
  selectedCategory: string | null; // Now uses categoryId instead of category string
  selectedCategoryPath: string | null; // Display path for selected category
  priceRange: {
    min: number | null;
    max: number | null;
  };
  selectedTags: string[];
  dateRange: {
    from: Date | null;
    to: Date | null;
    preset?: 'week' | 'month' | 'quarter' | 'year' | 'custom';
  };
  sortBy: 'date' | 'name' | 'price';
  sortDirection: 'asc' | 'desc';
}



interface ProductsListProps {
  initialProducts: ProductIndexItem[];
}

export default function ProductsList({ initialProducts }: ProductsListProps) {
  const [products, setProducts] = useState<ProductIndexItem[]>(initialProducts);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(initialProducts.length === 0); // Loading if starting with empty

  // Search and filtering state
  const [searchState, setSearchState] = useState<SearchState>({
    searchTerm: '',
    selectedCategory: null,
    selectedCategoryPath: null,
    priceRange: { min: null, max: null },
    selectedTags: [],
    dateRange: { from: null, to: null },
    sortBy: 'date',
    sortDirection: 'desc'
  });

  // Debounced search term for performance
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchState.searchTerm);
  
  const refreshProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      // Fetch fresh data directly (no cache revalidation needed)
      const response = await fetch('/api/products', {
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
      } else {
        console.error('Failed to refresh products:', response.status);
      }
    } catch (error) {
      console.error('Failed to refresh products:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchState.searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchState.searchTerm]);

  // Auto-refresh products when component mounts or gets focus
  useEffect(() => {
    refreshProducts();
    
    const handleFocus = () => {
      refreshProducts();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refreshProducts]);

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

  // Search and filtering functions
  const filterProducts = useCallback((productsToFilter: ProductIndexItem[], state: SearchState, searchTerm: string): ProductIndexItem[] => {
    return productsToFilter.filter(product => {
      // Text search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesText = 
          product.productName.toLowerCase().includes(searchLower) ||
          product.category.toLowerCase().includes(searchLower);
        if (!matchesText) return false;
      }

      // Category filter - support both new categoryId and legacy category string
      if (state.selectedCategory) {
        const matchesNewCategory = product.categoryId === state.selectedCategory;
        const matchesLegacyCategory = product.category === state.selectedCategory;
        if (!matchesNewCategory && !matchesLegacyCategory) {
          return false;
        }
      }

      // Price range filter
      if (state.priceRange.min !== null && product.pricing.price < state.priceRange.min) {
        return false;
      }
      if (state.priceRange.max !== null && product.pricing.price > state.priceRange.max) {
        return false;
      }

      // Date range filter
      if (state.dateRange.from || state.dateRange.to) {
        const productDate = new Date(product.createdAt);
        if (state.dateRange.from && productDate < state.dateRange.from) {
          return false;
        }
        if (state.dateRange.to && productDate > state.dateRange.to) {
          return false;
        }
      }

      // Tag filter (would need tags in product data structure)
      // if (state.selectedTags.length > 0) {
      //   const hasMatchingTag = state.selectedTags.some(tag => 
      //     product.tags?.includes(tag)
      //   );
      //   if (!hasMatchingTag) return false;
      // }

      return true;
    });
  }, []);

  const sortProducts = useCallback((productsToSort: ProductIndexItem[], state: SearchState): ProductIndexItem[] => {
    const sorted = [...productsToSort].sort((a, b) => {
      let comparison = 0;
      
      switch (state.sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'name':
          comparison = a.productName.localeCompare(b.productName);
          break;
        case 'price':
          comparison = a.pricing.price - b.pricing.price;
          break;
        default:
          return 0;
      }

      return state.sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, []);

  // Memoized filtered and sorted products
  const filteredAndSortedProducts = useMemo(() => {
    const filtered = filterProducts(products, searchState, debouncedSearchTerm);
    return sortProducts(filtered, searchState);
  }, [products, searchState, debouncedSearchTerm, filterProducts, sortProducts]);

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
    if (selectedProducts.size === filteredAndSortedProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredAndSortedProducts.map(p => p.id)));
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
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading products...</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Generated Products</h1>
                <p className="text-base text-gray-700 mt-2">
                  {filteredAndSortedProducts.length} of {products.length} product{products.length !== 1 ? 's' : ''} shown
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

        {/* Search and Filter Interface */}
        {products.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
              {/* Search Input */}
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchState.searchTerm}
                    onChange={(e) => setSearchState(prev => ({ ...prev, searchTerm: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2 text-base text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Search products"
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-3 items-center">
                <SimpleCategorySelect
                  value={searchState.selectedCategory}
                  onChange={(categoryId, categoryPath) => setSearchState(prev => ({
                    ...prev,
                    selectedCategory: categoryId,
                    selectedCategoryPath: categoryPath
                  }))}
                  placeholder="All Categories"
                  allowEmpty={true}
                  className="text-base text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />

                {/* Price Range Filter */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min $"
                    value={searchState.priceRange.min ?? ''}
                    onChange={(e) => setSearchState(prev => ({
                      ...prev,
                      priceRange: {
                        ...prev.priceRange,
                        min: e.target.value ? Number(e.target.value) : null
                      }
                    }))}
                    className="w-24 px-2 py-2 text-base text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-gray-700 font-medium">-</span>
                  <input
                    type="number"
                    placeholder="Max $"
                    value={searchState.priceRange.max ?? ''}
                    onChange={(e) => setSearchState(prev => ({
                      ...prev,
                      priceRange: {
                        ...prev.priceRange,
                        max: e.target.value ? Number(e.target.value) : null
                      }
                    }))}
                    className="w-24 px-2 py-2 text-base text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Sort Controls */}
                <select
                  value={`${searchState.sortBy}-${searchState.sortDirection}`}
                  onChange={(e) => {
                    const [sortBy, sortDirection] = e.target.value.split('-') as [typeof searchState.sortBy, typeof searchState.sortDirection];
                    setSearchState(prev => ({ ...prev, sortBy, sortDirection }));
                  }}
                  className="px-3 py-2 text-base text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="price-asc">Price Low-High</option>
                  <option value="price-desc">Price High-Low</option>
                </select>

                {/* Clear Filters Button */}
                {(searchState.searchTerm || searchState.selectedCategory || 
                  searchState.priceRange.min !== null || searchState.priceRange.max !== null) && (
                  <button
                    onClick={() => setSearchState({
                      searchTerm: '',
                      selectedCategory: null,
                      selectedCategoryPath: null,
                      priceRange: { min: null, max: null },
                      selectedTags: [],
                      dateRange: { from: null, to: null },
                      sortBy: 'date',
                      sortDirection: 'desc'
                    })}
                    className="px-3 py-2 text-base text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                  >
                    <X className="h-4 w-4" />
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Active Filters Display */}
            {(searchState.searchTerm || searchState.selectedCategory || 
              searchState.priceRange.min !== null || searchState.priceRange.max !== null) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {searchState.searchTerm && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-base font-medium bg-blue-100 text-blue-900">
                    Search: &quot;{searchState.searchTerm}&quot;
                    <button
                      onClick={() => setSearchState(prev => ({ ...prev, searchTerm: '' }))}
                      className="ml-2 h-4 w-4 text-blue-700 hover:text-blue-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {searchState.selectedCategory && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-base font-medium bg-green-100 text-green-900">
                    Category: {searchState.selectedCategoryPath || searchState.selectedCategory}
                    <button
                      onClick={() => setSearchState(prev => ({ ...prev, selectedCategory: null, selectedCategoryPath: null }))}
                      className="ml-2 h-4 w-4 text-green-700 hover:text-green-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {(searchState.priceRange.min !== null || searchState.priceRange.max !== null) && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-base font-medium bg-purple-100 text-purple-900">
                    Price: {searchState.priceRange.min !== null ? `$${searchState.priceRange.min}` : '$0'} - {searchState.priceRange.max !== null ? `$${searchState.priceRange.max}` : '∞'}
                    <button
                      onClick={() => setSearchState(prev => ({ 
                        ...prev, 
                        priceRange: { min: null, max: null } 
                      }))}
                      className="ml-2 h-4 w-4 text-purple-700 hover:text-purple-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {products.length > 0 && (
          <div className="mb-4 flex items-center">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedProducts.size === filteredAndSortedProducts.length && filteredAndSortedProducts.length > 0}
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
        ) : filteredAndSortedProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search className="mx-auto h-12 w-12" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your search criteria or filters</p>
            <button
              onClick={() => setSearchState({
                searchTerm: '',
                selectedCategory: null,
                selectedCategoryPath: null,
                priceRange: { min: null, max: null },
                selectedTags: [],
                dateRange: { from: null, to: null },
                sortBy: 'date',
                sortDirection: 'desc'
              })}
              className="inline-flex items-center px-6 py-3 text-base font-medium bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedProducts.map((product) => (
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
                  
                  <div className="flex items-center justify-between mb-3">
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
                  
                  <AddToCartButton
                    product={{
                      id: product.id,
                      productName: product.productName,
                      slug: product.slug,
                      imageUrl: product.imageUrl,
                      pricing: product.pricing,
                      category: product.category,
                    }}
                    size="sm"
                    className="w-full"
                  />
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
          </>
        )}
      </div>
    </div>
  );
}