import { put, list, del } from '@vercel/blob';

export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  productCount?: number; // Computed field
}

export interface CategoryTree {
  category: Category;
  children: CategoryTree[];
  level: number; // 0 for parent, 1 for subcategory
}

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

interface ProductRecord extends ProductData {
  id: string;
  imageUrl: string;
  createdAt: string;
  slug: string;
  categoryId?: string; // New structured category reference
  categoryPath?: string; // Full category path
}

interface ProductIndexItem {
  id: string;
  productName: string;
  slug: string;
  category: string; // Legacy field for backward compatibility
  categoryId?: string; // New structured category reference
  categoryPath?: string; // Full category path (e.g., "Electronics > Smartphones")
  createdAt: string;
  imageUrl: string;
  pricing: ProductData['pricing'];
}

const PRODUCTS_INDEX_KEY = 'products-index.json';
const CATEGORIES_KEY = 'categories.json';
const blobUrl = process.env.BLOB_DB_URL;

if (!blobUrl) {
  console.error('BLOB_DB_URL environment variable is not set');
}

// Save product data to Vercel Blob
export async function saveProductToBlob(productRecord: ProductRecord): Promise<void> {
  const productKey = `products/${productRecord.id}.json`;
  
  // Save individual product with appropriate caching
  await put(productKey, JSON.stringify(productRecord, null, 2), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
    cacheControlMaxAge: 30, // 30 second cache for individual products
  });

  // Update products index (this will handle cache invalidation)
  await updateProductsIndex(productRecord);
  
  console.log(`Product ${productRecord.id} saved successfully with cache invalidation`);
}

// Get product from Vercel Blob
export async function getProductFromBlob(productId: string): Promise<ProductRecord | null> {
  try {
    if (!blobUrl) {
      console.error('BLOB_DB_URL is not configured');
      return null;
    }

    const productKey = `products/${productId}.json`;
    const response = await fetch(`${blobUrl}${productKey}`, {
      cache: 'default', // Allow browser and CDN caching
      headers: {
        'Cache-Control': 'public, max-age=30', // 30 second cache for individual products
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching product from blob:', error);
    return null;
  }
}

// Get all products from index
export async function getProductsFromBlob(): Promise<ProductIndexItem[]> {
  try {
    if (!blobUrl) {
      console.error('BLOB_DB_URL is not configured');
      return [];
    }

    // Use standard URL without cache-busting for stable data
    const url = `${blobUrl}${PRODUCTS_INDEX_KEY}`;
    console.log('Fetching products from:', url);
    
    const response = await fetch(url, {
      cache: 'default', // Allow Next.js and browser caching
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 minute cache
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch products index:', response.status, response.statusText);
      return [];
    }
    
    const products = await response.json();
    console.log('Successfully fetched', products.length, 'products');
    return products;
  } catch (error) {
    console.error('Error fetching products index from blob:', error);
    return [];
  }
}

// Delete product from Vercel Blob
export async function deleteProductFromBlob(productId: string): Promise<void> {
  try {
    console.log('Starting deletion of product:', productId);
    
    // Get product data first to get image URL
    const product = await getProductFromBlob(productId);
    console.log('Found product to delete:', product?.productName);
    
    // Delete product JSON
    const productKey = `products/${productId}.json`;
    console.log('Deleting product file:', productKey);
    await del(productKey);

    // Delete associated image if it exists and is stored in blob
    if (product?.imageUrl && product.imageUrl.includes('vercel-storage.com')) {
      const imageKey = product.imageUrl.split('/').pop();
      if (imageKey) {
        console.log('Deleting associated image:', imageKey);
        await del(`images/${imageKey}`);
      }
    }

    // Update products index
    console.log('Updating products index to remove:', productId);
    await removeFromProductsIndex(productId);
    console.log('Product deletion completed successfully');
  } catch (error) {
    console.error('Error deleting product from blob:', error);
    throw error;
  }
}

// Upload image to Vercel Blob
export async function uploadImageToBlob(file: File): Promise<string> {
  const fileName = `${Date.now()}-${file.name}`;
  const imageKey = `images/${fileName}`;
  
  const blob = await put(imageKey, file, {
    access: 'public',
    contentType: file.type,
    allowOverwrite: true,
    cacheControlMaxAge: 86400, // 24 hour cache for images (static assets)
  });

  return blob.url;
}

// Update products index
async function updateProductsIndex(productRecord: ProductRecord): Promise<void> {
  try {
    let productsIndex: ProductIndexItem[] = await getProductsFromBlob();

    // Remove existing entry if it exists (for updates)
    productsIndex = productsIndex.filter(p => p.id !== productRecord.id);

    // Add new entry
    const indexItem: ProductIndexItem = {
      id: productRecord.id,
      productName: productRecord.productName,
      slug: productRecord.slug,
      category: productRecord.category, // Legacy field for backward compatibility
      categoryId: productRecord.categoryId, // New structured category reference
      categoryPath: productRecord.categoryPath, // Full category path
      createdAt: productRecord.createdAt,
      imageUrl: productRecord.imageUrl,
      pricing: productRecord.pricing
    };

    productsIndex.push(indexItem);

    // Sort by creation date (newest first)
    productsIndex.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Save updated index with cache invalidation for immediate consistency
    await put(PRODUCTS_INDEX_KEY, JSON.stringify(productsIndex, null, 2), {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true,
      cacheControlMaxAge: 300, // Allow 5-minute caching for subsequent reads
    });
    
    console.log('Products index updated successfully with cache invalidation');
  } catch (error) {
    console.error('Failed to update products index:', error);
    throw error;
  }
}

// Remove from products index with immediate cache invalidation
async function removeFromProductsIndex(productId: string): Promise<void> {
  try {
    let productsIndex: ProductIndexItem[] = await getProductsFromBlob();

    // Remove the deleted product
    const originalLength = productsIndex.length;
    productsIndex = productsIndex.filter(p => p.id !== productId);
    
    if (productsIndex.length === originalLength) {
      console.log('Product not found in index, might already be deleted');
      return;
    }

    // Save updated index with cache invalidation for immediate consistency
    await put(PRODUCTS_INDEX_KEY, JSON.stringify(productsIndex, null, 2), {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true,
      cacheControlMaxAge: 300, // Allow 5-minute caching for subsequent reads
    });

    console.log(`Successfully removed product ${productId} from index`);
  } catch (error) {
    console.error('Failed to remove from products index:', error);
    throw error;
  }
}

// List all blobs (for debugging/admin purposes)
export async function listAllBlobs() {
  const { blobs } = await list();
  return blobs;
}

// Category Management Functions

// Generate unique slug from category name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Save categories to Vercel Blob
export async function saveCategoriesToBlob(categories: Category[]): Promise<void> {
  await put(CATEGORIES_KEY, JSON.stringify(categories, null, 2), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
  });
}

// Get all categories from Vercel Blob
export async function getCategoriesFromBlob(): Promise<Category[]> {
  try {
    if (!blobUrl) {
      console.error('BLOB_DB_URL is not configured');
      return [];
    }

    const cacheBuster = `?t=${Date.now()}&r=${Math.random()}`;
    const url = `${blobUrl}${CATEGORIES_KEY}${cacheBuster}`;
    
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      }
    });
    
    if (!response.ok) {
      // If categories don't exist yet, return empty array
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching categories from blob:', error);
    return [];
  }
}

// Build category tree from flat array
export function buildCategoryTree(categories: Category[]): CategoryTree[] {
  const categoryMap = new Map<string, Category>();
  const rootCategories: CategoryTree[] = [];

  // Create a map for quick lookup
  categories.forEach(cat => categoryMap.set(cat.id, cat));

  // Build tree structure
  categories.forEach(category => {
    if (!category.parentId) {
      // Root category
      const tree: CategoryTree = {
        category,
        children: [],
        level: 0
      };
      rootCategories.push(tree);
    }
  });

  // Add children to parent categories
  categories.forEach(category => {
    if (category.parentId) {
      const parent = rootCategories.find(root => root.category.id === category.parentId);
      if (parent) {
        parent.children.push({
          category,
          children: [],
          level: 1
        });
      }
    }
  });

  return rootCategories;
}

// Validate category hierarchy (max 2 levels)
export function validateCategoryHierarchy(categories: Category[], newCategory: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): string | null {
  if (newCategory.parentId) {
    const parent = categories.find(cat => cat.id === newCategory.parentId);
    if (!parent) {
      return 'Parent category not found';
    }
    
    // Check if parent already has a parent (would create 3+ levels)
    if (parent.parentId) {
      return 'Cannot create category more than 2 levels deep';
    }
  }
  
  // Check for name uniqueness within the same level
  const siblings = categories.filter(cat => cat.parentId === newCategory.parentId);
  const nameExists = siblings.some(cat => cat.name.toLowerCase() === newCategory.name.toLowerCase());
  if (nameExists) {
    return 'Category name already exists at this level';
  }
  
  return null; // Valid
}

// Get category path (e.g., "Electronics > Smartphones")
export function getCategoryPath(categories: Category[], categoryId: string): string {
  const category = categories.find(cat => cat.id === categoryId);
  if (!category) return '';
  
  if (category.parentId) {
    const parent = categories.find(cat => cat.id === category.parentId);
    if (parent) {
      return `${parent.name} > ${category.name}`;
    }
  }
  
  return category.name;
}

// Create a new category
export async function createCategory(categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> {
  const categories = await getCategoriesFromBlob();
  
  // Validate hierarchy
  const validationError = validateCategoryHierarchy(categories, categoryData);
  if (validationError) {
    throw new Error(validationError);
  }
  
  const newCategory: Category = {
    ...categoryData,
    id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  const updatedCategories = [...categories, newCategory];
  await saveCategoriesToBlob(updatedCategories);
  
  return newCategory;
}

// Update a category
export async function updateCategory(categoryId: string, updates: Partial<Omit<Category, 'id' | 'createdAt'>>): Promise<Category> {
  const categories = await getCategoriesFromBlob();
  const categoryIndex = categories.findIndex(cat => cat.id === categoryId);
  
  if (categoryIndex === -1) {
    throw new Error('Category not found');
  }
  
  const updatedCategory = {
    ...categories[categoryIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  // Validate if name or parent is being changed
  if (updates.name || updates.parentId !== undefined) {
    const tempCategory = {
      name: updatedCategory.name,
      description: updatedCategory.description,
      parentId: updatedCategory.parentId,
      slug: updatedCategory.slug,
      isActive: updatedCategory.isActive,
    };
    
    const otherCategories = categories.filter(cat => cat.id !== categoryId);
    const validationError = validateCategoryHierarchy(otherCategories, tempCategory);
    if (validationError) {
      throw new Error(validationError);
    }
  }
  
  categories[categoryIndex] = updatedCategory;
  await saveCategoriesToBlob(categories);
  
  return updatedCategory;
}

// Delete a category
export async function deleteCategory(categoryId: string, options?: { handleProducts?: 'reassign' | 'uncategorized'; targetCategoryId?: string }): Promise<void> {
  const categories = await getCategoriesFromBlob();
  const categoryToDelete = categories.find(cat => cat.id === categoryId);
  
  if (!categoryToDelete) {
    throw new Error('Category not found');
  }
  
  // Check for subcategories
  const subcategories = categories.filter(cat => cat.parentId === categoryId);
  if (subcategories.length > 0) {
    throw new Error(`Cannot delete category with ${subcategories.length} subcategories. Handle subcategories first.`);
  }
  
  // Handle products if needed
  const products = await getProductsFromBlob();
  const affectedProducts = products.filter(product => product.categoryId === categoryId);
  
  if (affectedProducts.length > 0) {
    if (options?.handleProducts === 'reassign' && options.targetCategoryId) {
      // Reassign products to another category
      for (const product of affectedProducts) {
        const fullProduct = await getProductFromBlob(product.id);
        if (fullProduct) {
          fullProduct.category = options.targetCategoryId; // Update for compatibility
          await saveProductToBlob(fullProduct);
        }
      }
    } else if (options?.handleProducts === 'uncategorized') {
      // Move products to uncategorized
      for (const product of affectedProducts) {
        const fullProduct = await getProductFromBlob(product.id);
        if (fullProduct) {
          fullProduct.category = 'Uncategorized';
          await saveProductToBlob(fullProduct);
        }
      }
    } else {
      throw new Error(`Cannot delete category with ${affectedProducts.length} assigned products. Handle products first.`);
    }
  }
  
  // Remove category from storage
  const updatedCategories = categories.filter(cat => cat.id !== categoryId);
  await saveCategoriesToBlob(updatedCategories);
}

// Initialize default categories
export async function initializeDefaultCategories(): Promise<void> {
  const existingCategories = await getCategoriesFromBlob();
  
  // Only initialize if no categories exist
  if (existingCategories.length > 0) {
    console.log('Categories already exist, skipping initialization');
    return;
  }
  
  const defaultCategories: Category[] = [
    // Parent Categories
    {
      id: 'cat_electronics',
      name: 'Electronics',
      description: 'Electronic devices, gadgets, and technology products',
      parentId: null,
      slug: 'electronics',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_clothing',
      name: 'Clothing & Fashion',
      description: 'Apparel, footwear, and fashion accessories',
      parentId: null,
      slug: 'clothing-fashion',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_home',
      name: 'Home & Garden',
      description: 'Home improvement, furniture, and garden supplies',
      parentId: null,
      slug: 'home-garden',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_health',
      name: 'Health & Beauty',
      description: 'Personal care, wellness, and beauty products',
      parentId: null,
      slug: 'health-beauty',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_sports',
      name: 'Sports & Recreation',
      description: 'Sporting goods, fitness equipment, and recreational items',
      parentId: null,
      slug: 'sports-recreation',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    
    // Electronics Subcategories
    {
      id: 'cat_electronics_smartphones',
      name: 'Smartphones & Tablets',
      description: 'Mobile phones, tablets, and accessories',
      parentId: 'cat_electronics',
      slug: 'smartphones-tablets',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_electronics_computers',
      name: 'Computers & Laptops',
      description: 'Desktop computers, laptops, and computer accessories',
      parentId: 'cat_electronics',
      slug: 'computers-laptops',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_electronics_audio',
      name: 'Audio & Headphones',
      description: 'Headphones, speakers, and audio equipment',
      parentId: 'cat_electronics',
      slug: 'audio-headphones',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_electronics_smarthome',
      name: 'Smart Home & IoT',
      description: 'Smart home devices, IoT gadgets, and automation',
      parentId: 'cat_electronics',
      slug: 'smart-home-iot',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_electronics_gaming',
      name: 'Gaming & Entertainment',
      description: 'Gaming consoles, games, and entertainment devices',
      parentId: 'cat_electronics',
      slug: 'gaming-entertainment',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    
    // Clothing Subcategories
    {
      id: 'cat_clothing_mens',
      name: "Men's Clothing",
      description: "Men's apparel and fashion items",
      parentId: 'cat_clothing',
      slug: 'mens-clothing',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_clothing_womens',
      name: "Women's Clothing",
      description: "Women's apparel and fashion items",
      parentId: 'cat_clothing',
      slug: 'womens-clothing',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_clothing_shoes',
      name: 'Shoes & Footwear',
      description: 'Footwear for all occasions and activities',
      parentId: 'cat_clothing',
      slug: 'shoes-footwear',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_clothing_accessories',
      name: 'Accessories & Jewelry',
      description: 'Fashion accessories, jewelry, and personal items',
      parentId: 'cat_clothing',
      slug: 'accessories-jewelry',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_clothing_bags',
      name: 'Bags & Luggage',
      description: 'Handbags, backpacks, and travel luggage',
      parentId: 'cat_clothing',
      slug: 'bags-luggage',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    
    // Home & Garden Subcategories
    {
      id: 'cat_home_furniture',
      name: 'Furniture & Decor',
      description: 'Home furniture and decorative items',
      parentId: 'cat_home',
      slug: 'furniture-decor',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_home_kitchen',
      name: 'Kitchen & Dining',
      description: 'Kitchen appliances, cookware, and dining items',
      parentId: 'cat_home',
      slug: 'kitchen-dining',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_home_cleaning',
      name: 'Cleaning & Organization',
      description: 'Cleaning supplies and organization solutions',
      parentId: 'cat_home',
      slug: 'cleaning-organization',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_home_garden',
      name: 'Garden & Outdoor',
      description: 'Gardening tools, plants, and outdoor equipment',
      parentId: 'cat_home',
      slug: 'garden-outdoor',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_home_tools',
      name: 'Tools & Hardware',
      description: 'Tools, hardware, and DIY supplies',
      parentId: 'cat_home',
      slug: 'tools-hardware',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    
    // Health & Beauty Subcategories
    {
      id: 'cat_health_skincare',
      name: 'Skincare & Cosmetics',
      description: 'Skincare products, makeup, and cosmetics',
      parentId: 'cat_health',
      slug: 'skincare-cosmetics',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_health_wellness',
      name: 'Health & Wellness',
      description: 'Health products and wellness items',
      parentId: 'cat_health',
      slug: 'health-wellness',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_health_personal',
      name: 'Personal Care',
      description: 'Personal hygiene and care products',
      parentId: 'cat_health',
      slug: 'personal-care',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_health_supplements',
      name: 'Vitamins & Supplements',
      description: 'Vitamins, dietary supplements, and nutrition',
      parentId: 'cat_health',
      slug: 'vitamins-supplements',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_health_medical',
      name: 'Medical & Mobility',
      description: 'Medical supplies and mobility aids',
      parentId: 'cat_health',
      slug: 'medical-mobility',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    
    // Sports & Recreation Subcategories
    {
      id: 'cat_sports_fitness',
      name: 'Fitness Equipment',
      description: 'Exercise machines and fitness gear',
      parentId: 'cat_sports',
      slug: 'fitness-equipment',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_sports_outdoor',
      name: 'Outdoor Sports',
      description: 'Outdoor activities and adventure sports gear',
      parentId: 'cat_sports',
      slug: 'outdoor-sports',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_sports_team',
      name: 'Team Sports',
      description: 'Equipment for team sports and group activities',
      parentId: 'cat_sports',
      slug: 'team-sports',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_sports_water',
      name: 'Water Sports',
      description: 'Swimming, diving, and water activity equipment',
      parentId: 'cat_sports',
      slug: 'water-sports',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cat_sports_yoga',
      name: 'Exercise & Yoga',
      description: 'Yoga, pilates, and exercise accessories',
      parentId: 'cat_sports',
      slug: 'exercise-yoga',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  
  await saveCategoriesToBlob(defaultCategories);
  console.log('Default categories initialized successfully');
}