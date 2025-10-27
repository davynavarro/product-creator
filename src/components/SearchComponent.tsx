'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Filter, SlidersHorizontal, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface SearchResult {
  id: string;
  productName: string;
  tagline: string;
  description: string;
  pricing: {
    currency: string;
    price: number;
    originalPrice?: number;
    discount?: string;
  };
  imageUrl: string;
  category: string;
  relevanceScore: number;
  matchedFields: string[];
}

interface SearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
}

interface SearchProps {
  onClose?: () => void;
  autoFocus?: boolean;
  showFilters?: boolean;
  compact?: boolean;
}

export default function SearchComponent({ 
  onClose, 
  autoFocus = false, 
  showFilters = true,
  compact = false 
}: SearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [executionTime, setExecutionTime] = useState(0);
  const [total, setTotal] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [autoFocus]);

  const performSearch = async (searchQuery: string, searchFilters: SearchFilters = {}) => {
    if (!searchQuery.trim() && !searchFilters.category && !searchFilters.tags?.length) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (searchFilters.category) params.append('category', searchFilters.category);
      if (searchFilters.minPrice) params.append('minPrice', searchFilters.minPrice.toString());
      if (searchFilters.maxPrice) params.append('maxPrice', searchFilters.maxPrice.toString());
      if (searchFilters.tags?.length) params.append('tags', searchFilters.tags.join(','));
      params.append('limit', '20');

      const response = await fetch(`/api/search?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setResults(data.results || []);
        setTotal(data.total || 0);
        setExecutionTime(data.executionTime || 0);
        setShowResults(true);
      } else {
        console.error('Search error:', data.error);
        setResults([]);
        setShowResults(false);
      }
    } catch (error) {
      console.error('Search request failed:', error);
      setResults([]);
      setShowResults(false);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    
    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search
    debounceRef.current = setTimeout(() => {
      performSearch(value, filters);
    }, 300);
  };

  const handleFilterChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    performSearch(query, newFilters);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setFilters({});
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const formatPrice = (price: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  };

  const highlightMatches = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    let highlightedText = text;
    
    for (const term of searchTerms) {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
    }
    
    return highlightedText;
  };

  return (
    <div className={`relative ${compact ? 'w-full max-w-lg' : 'w-full'}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="h-5 w-5 text-gray-400" />
          )}
        </div>
        
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Search products..."
          className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center">
          {showFilters && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`p-2 text-gray-400 hover:text-gray-600 transition-colors ${
                Object.keys(filters).length > 0 ? 'text-blue-600' : ''
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          )}
          
          {(query || showResults) && (
            <button
              onClick={clearSearch}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors mr-1"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors mr-1"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilterPanel && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 flex items-center">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={filters.category || ''}
                  onChange={(e) => handleFilterChange({ ...filters, category: e.target.value || undefined })}
                  placeholder="Enter category..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              
              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Price
                </label>
                <input
                  type="number"
                  value={filters.minPrice || ''}
                  onChange={(e) => handleFilterChange({ ...filters, minPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="$0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Price
                </label>
                <input
                  type="number"
                  value={filters.maxPrice || ''}
                  onChange={(e) => handleFilterChange({ ...filters, maxPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="$1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  setFilters({});
                  performSearch(query, {});
                }}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Filters
              </button>
              <button
                onClick={() => setShowFilterPanel(false)}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-40">
          {results.length > 0 ? (
            <>
              <div className="px-4 py-2 border-b border-gray-100 text-sm text-gray-600">
                {total} results found in {executionTime}ms
              </div>
              <div className="py-2">
                {results.map((result) => (
                  <Link
                    key={result.id}
                    href={`/products/${result.id}`}
                    onClick={() => {
                      setShowResults(false);
                      onClose?.();
                    }}
                    className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <Image
                          src={result.imageUrl}
                          alt={result.productName}
                          width={48}
                          height={48}
                          className="rounded-lg object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 
                          className="text-sm font-medium text-gray-900 mb-1"
                          dangerouslySetInnerHTML={{ __html: highlightMatches(result.productName, query) }}
                        />
                        <p 
                          className="text-sm text-gray-600 mb-1 line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: highlightMatches(result.tagline, query) }}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-green-600">
                            {formatPrice(result.pricing.price, result.pricing.currency)}
                          </span>
                          <div className="flex items-center space-x-1">
                            <span className="text-xs text-gray-500">{result.category}</span>
                            <span className="text-xs text-blue-600">
                              Score: {result.relevanceScore}
                            </span>
                          </div>
                        </div>
                        {result.matchedFields.length > 0 && (
                          <div className="mt-1">
                            <span className="text-xs text-gray-400">
                              Matches: {result.matchedFields.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No products found for &ldquo;{query}&rdquo;</p>
              <p className="text-sm mt-1">Try different keywords or adjust your filters</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}