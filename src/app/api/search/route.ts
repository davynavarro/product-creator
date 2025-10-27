import { NextRequest, NextResponse } from 'next/server';
import { getProductsFromSupabase, getProductFromSupabase } from '@/lib/supabase-storage';

interface ProductRecord {
  id: string;
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
  imageUrl: string;
  createdAt: string;
  slug: string;
  categoryId?: string;
  categoryPath?: string;
}

interface SearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
}

interface SearchResult extends ProductRecord {
  relevanceScore: number;
  matchedFields: string[];
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  filters: SearchFilters;
  executionTime: number;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || undefined;
    const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined;
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined;
    const tags = searchParams.get('tags') ? searchParams.get('tags')!.split(',') : undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const sortBy = searchParams.get('sortBy') || 'relevance'; // relevance, price, name, date

    if (!query.trim() && !category && !tags) {
      return NextResponse.json({
        results: [],
        total: 0,
        query,
        filters: { category, minPrice, maxPrice, tags },
        executionTime: Date.now() - startTime,
        error: 'Please provide a search query or filters'
      } as SearchResponse, { status: 400 });
    }

    // Fetch all products from Supabase
    const productsIndex = await getProductsFromSupabase();
    const products: ProductRecord[] = [];

    // Fetch individual product details and format them
    for (const productItem of productsIndex) {
      try {
        const product = await getProductFromSupabase(productItem.id);
        if (product) {
          // Convert ProductData to ProductRecord format
          const productRecord: ProductRecord = {
            id: productItem.id,
            productName: product.productName,
            tagline: product.tagline,
            description: product.description,
            keyFeatures: product.keyFeatures,
            specifications: product.specifications,
            pricing: product.pricing,
            benefits: product.benefits,
            targetAudience: product.targetAudience,
            category: product.category,
            tags: product.tags,
            imageUrl: product.imageUrl || productItem.imageUrl,
            createdAt: product.createdAt,
            slug: product.slug,
            categoryId: product.categoryId,
            categoryPath: product.categoryPath
          };
          products.push(productRecord);
        }
      } catch (error) {
        console.error(`Error fetching product ${productItem.id}:`, error);
      }
    }

    // Perform search and filtering
    let results: SearchResult[] = [];

    if (query.trim()) {
      results = searchProducts(products, query);
    } else {
      // If no query, convert all products to search results
      results = products.map(product => ({
        ...product,
        relevanceScore: 1,
        matchedFields: []
      }));
    }

    // Apply filters
    const filters: SearchFilters = { category, minPrice, maxPrice, tags };
    results = applyFilters(results, filters);

    // Apply sorting
    results = sortResults(results, sortBy);

    // Apply limit
    results = results.slice(0, limit);

    const executionTime = Date.now() - startTime;

    const response = NextResponse.json({
      results,
      total: results.length,
      query,
      filters,
      executionTime
    } as SearchResponse);

    // Disable all caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({
      results: [],
      total: 0,
      query: '',
      filters: {},
      executionTime: Date.now() - startTime,
      error: 'Internal server error'
    } as SearchResponse, { status: 500 });
  }
}

function searchProducts(products: ProductRecord[], query: string): SearchResult[] {
  const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
  const results: SearchResult[] = [];

  for (const product of products) {
    let relevanceScore = 0;
    const matchedFields: string[] = [];

    // Search in product name (highest weight)
    const nameMatches = countMatches(product.productName.toLowerCase(), searchTerms);
    if (nameMatches > 0) {
      relevanceScore += nameMatches * 10;
      matchedFields.push('name');
    }

    // Search in tagline (high weight)
    const taglineMatches = countMatches(product.tagline.toLowerCase(), searchTerms);
    if (taglineMatches > 0) {
      relevanceScore += taglineMatches * 8;
      matchedFields.push('tagline');
    }

    // Search in description (medium weight)
    const descMatches = countMatches(product.description.toLowerCase(), searchTerms);
    if (descMatches > 0) {
      relevanceScore += descMatches * 5;
      matchedFields.push('description');
    }

    // Search in key features (medium weight)
    const featuresText = product.keyFeatures.join(' ').toLowerCase();
    const featureMatches = countMatches(featuresText, searchTerms);
    if (featureMatches > 0) {
      relevanceScore += featureMatches * 6;
      matchedFields.push('features');
    }

    // Search in benefits (medium weight)
    const benefitsText = product.benefits.join(' ').toLowerCase();
    const benefitMatches = countMatches(benefitsText, searchTerms);
    if (benefitMatches > 0) {
      relevanceScore += benefitMatches * 5;
      matchedFields.push('benefits');
    }

    // Search in category (medium weight)
    const categoryMatches = countMatches(product.category.toLowerCase(), searchTerms);
    if (categoryMatches > 0) {
      relevanceScore += categoryMatches * 6;
      matchedFields.push('category');
    }

    // Search in tags (medium weight)
    const tagsText = product.tags.join(' ').toLowerCase();
    const tagMatches = countMatches(tagsText, searchTerms);
    if (tagMatches > 0) {
      relevanceScore += tagMatches * 5;
      matchedFields.push('tags');
    }

    // Search in target audience (lower weight)
    const audienceMatches = countMatches(product.targetAudience.toLowerCase(), searchTerms);
    if (audienceMatches > 0) {
      relevanceScore += audienceMatches * 3;
      matchedFields.push('audience');
    }

    // Search in specifications (lower weight)
    const specificationsText = Object.values(product.specifications).join(' ').toLowerCase();
    const specMatches = countMatches(specificationsText, searchTerms);
    if (specMatches > 0) {
      relevanceScore += specMatches * 2;
      matchedFields.push('specifications');
    }

    // Only include results with matches
    if (relevanceScore > 0) {
      results.push({
        ...product,
        relevanceScore,
        matchedFields
      });
    }
  }

  // Sort by relevance score (descending)
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function countMatches(text: string, searchTerms: string[]): number {
  let matches = 0;
  for (const term of searchTerms) {
    // Count exact word matches
    const wordRegex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');
    const wordMatches = (text.match(wordRegex) || []).length;
    matches += wordMatches * 2; // Exact word matches get double weight

    // Count partial matches
    if (text.includes(term)) {
      matches += 1;
    }
  }
  return matches;
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyFilters(results: SearchResult[], filters: SearchFilters): SearchResult[] {
  let filtered = results;

  // Category filter
  if (filters.category) {
    filtered = filtered.filter(product => 
      product.category.toLowerCase().includes(filters.category!.toLowerCase()) ||
      product.categoryPath?.toLowerCase().includes(filters.category!.toLowerCase())
    );
  }

  // Price range filter
  if (filters.minPrice !== undefined) {
    filtered = filtered.filter(product => product.pricing.price >= filters.minPrice!);
  }

  if (filters.maxPrice !== undefined) {
    filtered = filtered.filter(product => product.pricing.price <= filters.maxPrice!);
  }

  // Tags filter
  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter(product => 
      filters.tags!.some(tag => 
        product.tags.some(productTag => 
          productTag.toLowerCase().includes(tag.toLowerCase())
        )
      )
    );
  }

  return filtered;
}

function sortResults(results: SearchResult[], sortBy: string): SearchResult[] {
  switch (sortBy) {
    case 'price':
      return results.sort((a, b) => a.pricing.price - b.pricing.price);
    case 'price-desc':
      return results.sort((a, b) => b.pricing.price - a.pricing.price);
    case 'name':
      return results.sort((a, b) => a.productName.localeCompare(b.productName));
    case 'date':
      return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'relevance':
    default:
      return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}