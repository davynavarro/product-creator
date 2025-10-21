import { NextRequest, NextResponse } from 'next/server';
import {
  getProductsFromBlob,
  getProductFromBlob,
  saveProductToBlob,
  getCategoriesFromBlob,
  getCategoryPath,
  initializeDefaultCategories,
} from '@/lib/blob-storage';

// POST /api/migrate-categories - Migrate existing products to use structured categories
export async function POST(request: NextRequest) {
  try {
    const { dryRun = false } = await request.json().catch(() => ({}));
    
    // Initialize categories first
    await initializeDefaultCategories();
    
    // Get all categories and products
    const categories = await getCategoriesFromBlob();
    const products = await getProductsFromBlob();
    
    const migrationResults = {
      totalProducts: products.length,
      migratedProducts: 0,
      skippedProducts: 0,
      errors: [] as string[],
      mappings: [] as Array<{
        productId: string;
        productName: string;
        oldCategory: string;
        newCategoryId: string | null;
        newCategoryPath: string | null;
      }>,
    };

    // Create a mapping from legacy category names to new category IDs
    const categoryMapping = new Map<string, { id: string; path: string }>();
    
    // Build mapping based on category names (case-insensitive)
    categories.forEach(category => {
      const path = getCategoryPath(categories, category.id);
      
      // Direct name matches
      categoryMapping.set(category.name.toLowerCase(), { id: category.id, path });
      
      // Common legacy mappings
      const legacyMappings: Record<string, string[]> = {
        'electronics': ['electronics', 'electronic', 'tech', 'technology'],
        'smartphones & tablets': ['smartphone', 'phone', 'mobile', 'tablet', 'iphone', 'android'],
        'computers & laptops': ['computer', 'laptop', 'pc', 'desktop', 'notebook'],
        'audio & headphones': ['audio', 'headphone', 'headphones', 'speaker', 'earphone'],
        'smart home & iot': ['smart home', 'iot', 'automation', 'smart device'],
        'gaming & entertainment': ['gaming', 'game', 'entertainment', 'console'],
        
        'clothing & fashion': ['clothing', 'fashion', 'apparel', 'wear'],
        "men's clothing": ['mens', "men's", 'male clothing'],
        "women's clothing": ['womens', "women's", 'female clothing'],
        'shoes & footwear': ['shoes', 'footwear', 'sneaker', 'boot'],
        'accessories & jewelry': ['accessories', 'jewelry', 'jewellery', 'accessory'],
        'bags & luggage': ['bags', 'luggage', 'backpack', 'handbag'],
        
        'home & garden': ['home', 'garden', 'household', 'outdoor'],
        'furniture & decor': ['furniture', 'decor', 'decoration', 'home decor'],
        'kitchen & dining': ['kitchen', 'dining', 'cookware', 'appliance'],
        'cleaning & organization': ['cleaning', 'organization', 'storage'],
        'garden & outdoor': ['garden', 'outdoor', 'landscaping', 'patio'],
        'tools & hardware': ['tools', 'hardware', 'diy', 'construction'],
        
        'health & beauty': ['health', 'beauty', 'wellness', 'personal care'],
        'skincare & cosmetics': ['skincare', 'cosmetics', 'makeup', 'beauty products'],
        'health & wellness': ['wellness', 'health products', 'fitness'],
        'personal care': ['personal care', 'hygiene', 'grooming'],
        'vitamins & supplements': ['vitamins', 'supplements', 'nutrition'],
        'medical & mobility': ['medical', 'mobility', 'healthcare'],
        
        'sports & recreation': ['sports', 'recreation', 'fitness', 'exercise'],
        'fitness equipment': ['fitness', 'exercise equipment', 'workout'],
        'outdoor sports': ['outdoor sports', 'adventure', 'camping'],
        'team sports': ['team sports', 'ball sports', 'sports equipment'],
        'water sports': ['water sports', 'swimming', 'diving'],
        'exercise & yoga': ['yoga', 'pilates', 'exercise', 'meditation'],
      };

      // Add legacy mappings
      Object.entries(legacyMappings).forEach(([categoryName, aliases]) => {
        if (category.name.toLowerCase() === categoryName.toLowerCase()) {
          aliases.forEach(alias => {
            categoryMapping.set(alias.toLowerCase(), { id: category.id, path });
          });
        }
      });
    });

    // Process each product
    for (const productIndex of products) {
      try {
        // Skip if already migrated
        if (productIndex.categoryId) {
          migrationResults.skippedProducts++;
          continue;
        }

        // Get full product data
        const fullProduct = await getProductFromBlob(productIndex.id);
        if (!fullProduct) {
          migrationResults.errors.push(`Could not load product ${productIndex.id}`);
          continue;
        }

        // Try to map the legacy category
        const legacyCategory = fullProduct.category.toLowerCase();
        const mapping = categoryMapping.get(legacyCategory);
        
        let newCategoryId: string | null = null;
        let newCategoryPath: string | null = null;

        if (mapping) {
          newCategoryId = mapping.id;
          newCategoryPath = mapping.path;
        } else {
          // Try partial matches for unmapped categories
          for (const [key, value] of categoryMapping.entries()) {
            if (legacyCategory.includes(key) || key.includes(legacyCategory)) {
              newCategoryId = value.id;
              newCategoryPath = value.path;
              break;
            }
          }
        }

        // Record the mapping result
        migrationResults.mappings.push({
          productId: productIndex.id,
          productName: productIndex.productName,
          oldCategory: fullProduct.category,
          newCategoryId,
          newCategoryPath,
        });

        // Update the product if not a dry run
        if (!dryRun && newCategoryId) {
          // Update the full product record - keep legacy category for compatibility
          const updatedProduct = {
            ...fullProduct,
            // Keep existing category field for backward compatibility
          };

          // The product index will be updated automatically when saveProductToBlob is called

          await saveProductToBlob(updatedProduct);
          migrationResults.migratedProducts++;
        }

      } catch (error) {
        const errorMessage = `Error processing product ${productIndex.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        migrationResults.errors.push(errorMessage);
      }
    }

    // Return results
    return NextResponse.json({
      success: true,
      dryRun,
      results: migrationResults,
      message: dryRun 
        ? `Dry run completed. ${migrationResults.mappings.length} products analyzed.`
        : `Migration completed. ${migrationResults.migratedProducts} products updated.`
    });

  } catch (error) {
    console.error('Category migration error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Migration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/migrate-categories - Get migration status and preview
export async function GET() {
  try {
    const products = await getProductsFromBlob();
    const categories = await getCategoriesFromBlob();
    
    const stats = {
      totalProducts: products.length,
      migratedProducts: products.filter(p => p.categoryId).length,
      unmappedProducts: products.filter(p => !p.categoryId).length,
      totalCategories: categories.length,
      legacyCategories: [...new Set(products.map(p => p.category))].sort(),
      unmappedLegacyCategories: [...new Set(
        products
          .filter(p => !p.categoryId)
          .map(p => p.category)
      )].sort(),
    };

    return NextResponse.json({
      success: true,
      stats,
      needsMigration: stats.unmappedProducts > 0,
    });

  } catch (error) {
    console.error('Error getting migration status:', error);
    return NextResponse.json(
      { error: 'Failed to get migration status' },
      { status: 500 }
    );
  }
}