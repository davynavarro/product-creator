import { supabase, supabaseAdmin } from './supabase';

// Re-export for use in other modules
export { supabaseAdmin };

export interface CartItem {
  id: string;
  productName: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  addedAt: string;
}

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

export interface OrderData {
  orderId: string;
  paymentIntentId: string;
  customerInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    price: number;
    currency: string;
  }>;
  totals: {
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
    currency: string;
  };
  status: 'confirmed' | 'processing' | 'shipped' | 'delivered';
  createdAt: string;
  userId?: string;
}

export interface OrderIndexItem {
  orderId: string;
  customerEmail: string;
  customerName: string;
  total: number;
  currency: string;
  status: string;
  createdAt: string;
  userId?: string;
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
  categoryId: string;
  categoryConfidence: number;
  categoryReasoning: string;
  tags: string[];
  categoryPath: string;
  categoryMetadata: {
    level: number;
    parentCategory?: string;
    suggestedSubcategories: string[];
  };
  imageUrl?: string;
  createdAt: string;
  slug: string;
}

export interface ProductIndexItem {
  id: string;
  productName: string;
  slug: string;
  category: string;
  categoryId: string;
  categoryPath: string;
  createdAt: string;
  imageUrl: string;
  pricing: {
    currency: string;
    price: number;
    originalPrice?: number;
    discount?: string;
  };
}

// Storage bucket names
export const BUCKETS = {
  PRODUCTS: 'products',
  IMAGES: 'images', 
  CART: 'cart',
  CATEGORIES: 'categories',
  ORDERS: 'orders',
  PROFILES: 'profiles'
} as const;

// File paths
const FILES = {
  PRODUCTS_INDEX: 'products-index.json',
  CATEGORIES: 'categories.json'
} as const;

// Initialize storage buckets (call this once during setup)
export async function initializeSupabaseBuckets() {
  const bucketsToCreate = Object.values(BUCKETS);
  
  for (const bucketName of bucketsToCreate) {
    const { data: bucket } = await supabaseAdmin.storage.getBucket(bucketName);
    
    if (!bucket) {
      const { error } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['image/*', 'application/json'],
        fileSizeLimit: 10485760 // 10MB
      });
      
      if (error) {
        console.error(`Failed to create bucket ${bucketName}:`, error);
      } else {
        console.log(`Created bucket: ${bucketName}`);
      }
    }
  }
  
  // Initialize empty products index if it doesn't exist
  try {
    const { error } = await supabaseAdmin.storage
      .from(BUCKETS.PRODUCTS)
      .download(FILES.PRODUCTS_INDEX);
    
    if (error) {
      // File doesn't exist, create empty index
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKETS.PRODUCTS)
        .upload(FILES.PRODUCTS_INDEX, JSON.stringify([], null, 2), {
          contentType: 'application/json',
          upsert: false
        });
      
      if (uploadError) {
        console.error('Failed to create empty products index:', uploadError);
      } else {
        console.log('Created empty products index');
      }
    }
  } catch (error) {
    console.error('Error checking/creating products index:', error);
  }
  
  // Initialize default categories
  await initializeDefaultCategories();
}

// Product storage functions
export async function saveProductToSupabase(productData: ProductData): Promise<string> {
  try {
    const productId = `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fileName = `${productId}.json`;
    
    // Save individual product file
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKETS.PRODUCTS)
      .upload(fileName, JSON.stringify(productData, null, 2), {
        contentType: 'application/json',
        upsert: true
      });
    
    if (uploadError) {
      throw new Error(`Failed to save product: ${uploadError.message}`);
    }

    // Update products index
    await updateProductsIndex(productId, productData);
    
    console.log(`Product ${productId} saved successfully to Supabase`);
    return productId;
  } catch (error) {
    console.error('Error saving product to Supabase:', error);
    throw error;
  }
}

export async function getProductFromSupabase(productId: string): Promise<ProductData | null> {
  try {
    const fileName = `${productId}.json`;
    
    // Use supabaseAdmin for consistent permissions
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKETS.PRODUCTS)
      .download(fileName);
    
    if (error || !data) {
      console.error('Error fetching product:', error);
      return null;
    }
    
    const text = await data.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('Error parsing product data:', error);
    return null;
  }
}

export async function getProductsFromSupabase(): Promise<ProductIndexItem[]> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKETS.PRODUCTS)
      .download(FILES.PRODUCTS_INDEX);
    
    if (error || !data) {
      console.error('Error fetching products index:', error);
      return [];
    }
    
    const text = await data.text();
    const products = JSON.parse(text);
    console.log('Successfully fetched', products.length, 'products from Supabase');
    return products;
  } catch (error) {
    console.error('Error fetching products index from Supabase:', error);
    return [];
  }
}

async function updateProductsIndex(productId: string, productData: ProductData) {
  try {
    // Get existing index
    const existingProducts = await getProductsFromSupabase();
    
    // Create index item
    const indexItem: ProductIndexItem = {
      id: productId,
      productName: productData.productName,
      slug: productData.slug,
      category: productData.category,
      categoryId: productData.categoryId,
      categoryPath: productData.categoryPath,
      createdAt: productData.createdAt,
      imageUrl: productData.imageUrl || '',
      pricing: productData.pricing
    };
    
    // Update or add to index
    const updatedProducts = existingProducts.filter(p => p.id !== productId);
    updatedProducts.push(indexItem);
    
    // Save updated index
    const { error } = await supabaseAdmin.storage
      .from(BUCKETS.PRODUCTS)
      .upload(FILES.PRODUCTS_INDEX, JSON.stringify(updatedProducts, null, 2), {
        contentType: 'application/json',
        upsert: true
      });
    
    if (error) {
      throw new Error(`Failed to update products index: ${error.message}`);
    }
  } catch (error) {
    console.error('Error updating products index:', error);
    throw error;
  }
}

// Delete product functions
export async function deleteProductFromSupabase(productId: string): Promise<void> {
  try {
    console.log(`Starting deletion of product ${productId}...`);
    const startTime = Date.now();
    
    const fileName = `${productId}.json`;
    
    // Delete the individual product file
    console.log(`Deleting product file ${fileName}...`);
    const deleteStart = Date.now();
    const { error: deleteError } = await supabaseAdmin.storage
      .from(BUCKETS.PRODUCTS)
      .remove([fileName]);
    console.log(`Product file deletion took ${Date.now() - deleteStart}ms`);
    
    if (deleteError) {
      throw new Error(`Failed to delete product file: ${deleteError.message}`);
    }

    // Update products index by removing this product
    console.log(`Updating products index...`);
    const indexStart = Date.now();
    await removeFromProductsIndex(productId);
    console.log(`Index update took ${Date.now() - indexStart}ms`);
    
    const totalTime = Date.now() - startTime;
    console.log(`Product ${productId} deleted successfully from Supabase (total time: ${totalTime}ms)`);
  } catch (error) {
    console.error('Error deleting product from Supabase:', error);
    throw error;
  }
}

async function removeFromProductsIndex(productId: string) {
  try {
    // Get existing index
    console.log(`Fetching existing products index...`);
    const fetchStart = Date.now();
    const existingProducts = await getProductsFromSupabase();
    console.log(`Fetching index took ${Date.now() - fetchStart}ms (${existingProducts.length} products)`);
    
    // Remove the product from index
    const updatedProducts = existingProducts.filter(p => p.id !== productId);
    console.log(`Filtered ${existingProducts.length} -> ${updatedProducts.length} products`);
    
    // Save updated index
    console.log(`Uploading updated index...`);
    const uploadStart = Date.now();
    const { error } = await supabaseAdmin.storage
      .from(BUCKETS.PRODUCTS)
      .upload(FILES.PRODUCTS_INDEX, JSON.stringify(updatedProducts, null, 2), {
        contentType: 'application/json',
        upsert: true
      });
    console.log(`Uploading index took ${Date.now() - uploadStart}ms`);
    
    if (error) {
      throw new Error(`Failed to update products index: ${error.message}`);
    }
  } catch (error) {
    console.error('Error removing from products index:', error);
    throw error;
  }
}

// Image storage functions
export async function saveImageToSupabase(
  file: File | Buffer,
  filename: string
): Promise<string> {
  try {
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}-${filename}`;
    
    const { error } = await supabaseAdmin.storage
      .from(BUCKETS.IMAGES)
      .upload(uniqueFilename, file, {
        contentType: file instanceof File ? file.type : 'image/jpeg',
        upsert: true
      });
    
    if (error) {
      throw new Error(`Failed to upload image: ${error.message}`);
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKETS.IMAGES)
      .getPublicUrl(uniqueFilename);
    
    return publicUrl;
  } catch (error) {
    console.error('Error saving image to Supabase:', error);
    throw error;
  }
}

// Cart storage functions
export async function saveCartToSupabase(sessionId: string, cartItems: CartItem[]): Promise<void> {
  try {
    const fileName = `${sessionId}.json`;
    
    // First, get existing cart items
    const existingItems = await getCartFromSupabase(sessionId);

    // Create a map of existing items by ID for quick lookup
    const existingItemsMap = new Map<string, CartItem>();
    existingItems.forEach(item => {
      existingItemsMap.set(item.id, item);
    });
    
    // Merge new items with existing ones
    const mergedItems: CartItem[] = [];
    
    // Process new items
    cartItems.forEach(newItem => {
      const existingItem = existingItemsMap.get(newItem.id);
      if (existingItem) {
        // Item exists, update quantity and use the newer addedAt timestamp
        mergedItems.push({
          ...existingItem,
          quantity: newItem.quantity + existingItem.quantity, 
        });
        // Mark as processed
        existingItemsMap.delete(newItem.id);
      } else {
        // New item, add it
        mergedItems.push(newItem);
      }
    });
    
    // Add any remaining existing items that weren't updated
    existingItemsMap.forEach(item => {
      mergedItems.push(item);
    });
    
    // Sort by addedAt timestamp (newest first)
    mergedItems.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
    
    const { error } = await supabaseAdmin.storage
      .from(BUCKETS.CART)
      .upload(fileName, JSON.stringify(mergedItems, null, 2), {
        contentType: 'application/json',
        upsert: true
      });

    if (error) {
      throw new Error(`Failed to save cart: ${error.message}`);
    }
    
    console.log('Cart merged and saved to Supabase for session:', sessionId);
  } catch (error) {
    console.error('Error saving cart to Supabase:', error);
    throw error;
  }
}

export async function getCartFromSupabase(sessionId: string): Promise<CartItem[]> {
  try {
    const fileName = `${sessionId}.json`;
    
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKETS.CART)
      .download(fileName);
    
    if (error || !data) {
      return []; // Return empty cart if not found
    }
    
    const text = await data.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('Error fetching cart from Supabase:', error);
    return [];
  }
}

export async function deleteCartFromSupabase(sessionId: string, cartItems?: {productId: string, quantity: number}[]): Promise<void> {
  try {
    const fileName = `${sessionId}.json`;
    
    if (cartItems && cartItems.length > 0) {
      // Selective deletion: remove specific items from cart
      const existingItems = await getCartFromSupabase(sessionId);
      
      if (existingItems.length === 0) {
        console.log('No existing cart items to remove from');
        return;
      }
      
      // Create a map of items to remove for quick lookup
      const itemsToRemoveMap = new Map<string, number>();
      cartItems.forEach(item => {
        itemsToRemoveMap.set(item.productId, item.quantity);
      });
      
      // Process existing items and subtract quantities
      const updatedItems: CartItem[] = [];
      
      existingItems.forEach(existingItem => {
        const quantityToRemove = itemsToRemoveMap.get(existingItem.id);
        
        if (quantityToRemove !== undefined) {
          // Item is in removal list, subtract quantity
          const newQuantity = existingItem.quantity - quantityToRemove;
          
          if (newQuantity > 0) {
            // Keep item with reduced quantity
            updatedItems.push({
              ...existingItem,
              quantity: newQuantity
            });
          }
          // If newQuantity <= 0, item is completely removed (not added to updatedItems)
          
          console.log(`Item ${existingItem.id}: ${existingItem.quantity} - ${quantityToRemove} = ${newQuantity}${newQuantity <= 0 ? ' (removed)' : ''}`);
        } else {
          // Item not in removal list, keep as is
          updatedItems.push(existingItem);
        }
      });

      // console.log(`Updated cart for session: ${sessionId}. Items remaining: ${updatedItems.length}`);
      
      // Save updated cart
      const { error } = await supabaseAdmin.storage
        .from(BUCKETS.CART)
        .upload(fileName, JSON.stringify(updatedItems, null, 2), {
          contentType: 'application/json',
          upsert: true
        });
      
      if (error) {
        throw new Error(`Failed to update cart after removal: ${error.message}`);
      }
      
      console.log(`Selectively removed items from cart for session: ${sessionId}. Items remaining: ${updatedItems.length}`);
    } else {
      // Complete deletion: remove entire cart file
      const { error } = await supabaseAdmin.storage
        .from(BUCKETS.CART)
        .remove([fileName]);
      
      if (error) {
        console.error('Error deleting entire cart from Supabase:', error);
      } else {
        console.log(`Entire cart deleted for session: ${sessionId}`);
      }
    }
  } catch (error) { 
    console.error('Error in deleteCartFromSupabase:', error);
    throw error;
  }
}

// Category functions
export async function getCategoriesFromSupabase(): Promise<Category[]> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKETS.CATEGORIES)
      .download(FILES.CATEGORIES);
    
    if (error || !data) {
      // Return default categories if file doesn't exist
      return await initializeDefaultCategories();
    }
    
    const text = await data.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('Error fetching categories from Supabase:', error);
    return await initializeDefaultCategories();
  }
}

export async function saveCategoriesToSupabase(categories: Category[]): Promise<void> {
  try {
    const { error } = await supabaseAdmin.storage
      .from(BUCKETS.CATEGORIES)
      .upload(FILES.CATEGORIES, JSON.stringify(categories, null, 2), {
        contentType: 'application/json',
        upsert: true
      });
    
    if (error) {
      throw new Error(`Failed to save categories: ${error.message}`);
    }
  } catch (error) {
    console.error('Error saving categories to Supabase:', error);
    throw error;
  }
}

// Initialize default categories
export async function initializeDefaultCategories(): Promise<Category[]> {
  const defaultCategories: Category[] = [
    {
      id: 'cat_electronics',
      name: 'Electronics',
      description: 'Electronic devices and gadgets',
      slug: 'electronics',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parentId: null,
    },
    {
      id: 'cat_home_kitchen',
      name: 'Home & Garden',
      description: 'Home and kitchen essentials',
      slug: 'home-garden',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parentId: null,
    },
    {
      id: 'cat_1761053772630_mwrjp34f5',
      name: 'Collectibles',
      description: 'Collectible items and memorabilia',
      slug: 'collectibles',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parentId: null,
    }
  ];

  // Save to Supabase
  await saveCategoriesToSupabase(defaultCategories);
  return defaultCategories;
}

// Build category tree
export function buildCategoryTree(categories: Category[]): CategoryTree[] {
  const categoryMap = new Map<string, Category>();
  const roots: CategoryTree[] = [];

  // Create map for quick lookup
  categories.forEach(category => {
    categoryMap.set(category.id, category);
  });

  // Build tree structure
  categories.forEach(category => {
    const tree: CategoryTree = {
      category,
      children: [],
      level: category.parentId ? 1 : 0
    };

    if (!category.parentId) {
      roots.push(tree);
    } else {
      // Find parent and add as child
      const parentCategory = categoryMap.get(category.parentId);
      if (parentCategory) {
        const parentTree = roots.find(r => r.category.id === parentCategory.id);
        if (parentTree) {
          parentTree.children.push(tree);
        }
      }
    }
  });

  return roots;
}

// Get category path (compatible with blob-storage parameter order)
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

// Create a new category
export async function createCategoryInSupabase(categoryData: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> {
  const categories = await getCategoriesFromSupabase();
  
  // Validate hierarchy
  const validationError = validateCategoryHierarchy(categories, categoryData);
  if (validationError) {
    throw new Error(validationError);
  }
  
  const newCategory: Category = {
    ...categoryData,
    id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  const updatedCategories = [...categories, newCategory];
  await saveCategoriesToSupabase(updatedCategories);
  
  return newCategory;
}

// Update a category
export async function updateCategoryInSupabase(categoryId: string, updates: Partial<Omit<Category, 'id' | 'createdAt'>>): Promise<Category> {
  const categories = await getCategoriesFromSupabase();
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
  await saveCategoriesToSupabase(categories);
  
  return updatedCategory;
}

// Delete a category
export async function deleteCategoryFromSupabase(categoryId: string, options?: { handleProducts?: 'reassign' | 'uncategorized'; targetCategoryId?: string }): Promise<void> {
  const categories = await getCategoriesFromSupabase();
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
  const products = await getProductsFromSupabase();
  const affectedProducts = products.filter(product => product.categoryId === categoryId);
  
  if (affectedProducts.length > 0) {
    if (options?.handleProducts === 'reassign' && options.targetCategoryId) {
      // Reassign products to another category
      for (const product of affectedProducts) {
        const fullProduct = await getProductFromSupabase(product.id);
        if (fullProduct) {
          fullProduct.category = options.targetCategoryId; // Update for compatibility
          fullProduct.categoryId = options.targetCategoryId;
          fullProduct.categoryPath = getCategoryPath(categories, options.targetCategoryId);
          await saveProductToSupabase(fullProduct);
        }
      }
    } else if (options?.handleProducts === 'uncategorized') {
      // Move products to uncategorized
      for (const product of affectedProducts) {
        const fullProduct = await getProductFromSupabase(product.id);
        if (fullProduct) {
          fullProduct.category = 'Uncategorized';
          fullProduct.categoryId = 'uncategorized';
          fullProduct.categoryPath = 'Uncategorized';
          await saveProductToSupabase(fullProduct);
        }
      }
    } else {
      throw new Error(`Cannot delete category with ${affectedProducts.length} assigned products. Handle products first.`);
    }
  }
  
  // Remove category from storage
  const updatedCategories = categories.filter(cat => cat.id !== categoryId);
  await saveCategoriesToSupabase(updatedCategories);
}

// ========================================
// ORDER STORAGE FUNCTIONS
// ========================================

// Save order to Supabase
export async function saveOrderToSupabase(orderData: OrderData): Promise<string> {
  try {
    const fileName = `${orderData.orderId}.json`;
    
    // Try to upload the order
    const { error } = await supabaseAdmin.storage
      .from(BUCKETS.ORDERS)
      .upload(fileName, JSON.stringify(orderData, null, 2), {
        contentType: 'application/json',
        upsert: true
      });
    
    // If bucket doesn't exist, create it and try again
    if (error && error.message.includes('Bucket not found')) {
      console.log('Orders bucket not found, creating it...');
      
      const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKETS.ORDERS, {
        public: false
      });
      
      if (createError) {
        console.error('Error creating orders bucket:', createError);
        throw new Error(`Failed to create orders bucket: ${createError.message}`);
      }
      
      console.log('Orders bucket created successfully, retrying upload...');
      
      // Retry the upload
      const { error: retryError } = await supabaseAdmin.storage
        .from(BUCKETS.ORDERS)
        .upload(fileName, JSON.stringify(orderData, null, 2), {
          contentType: 'application/json',
          upsert: true
        });
      
      if (retryError) {
        console.error('Error saving order to Supabase after bucket creation:', retryError);
        throw new Error(`Failed to save order after bucket creation: ${retryError.message}`);
      }
    } else if (error) {
      console.error('Error saving order to Supabase:', error);
      throw new Error(`Failed to save order: ${error.message}`);
    }
    
    // Update orders index
    await updateOrdersIndex(orderData);
    
    console.log(`Order ${orderData.orderId} saved successfully to Supabase`);
    return orderData.orderId;
  } catch (error) {
    console.error('Error in saveOrderToSupabase:', error);
    throw error;
  }
}

// Get order from Supabase
export async function getOrderFromSupabase(orderId: string): Promise<OrderData | null> {
  try {
    const fileName = `${orderId}.json`;
    
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKETS.ORDERS)
      .download(fileName);
    
    if (error || !data) {
      console.error('Error fetching order:', error);
      return null;
    }
    
    const text = await data.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('Error parsing order data:', error);
    return null;
  }
}

// Get orders index from Supabase
export async function getOrdersFromSupabase(): Promise<OrderIndexItem[]> {
  try {
    console.log('Attempting to download orders-index.json from bucket:', BUCKETS.ORDERS);
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKETS.ORDERS)
      .download('orders-index.json');
    
    if (error) {
      console.error('Error downloading orders index:', error);
      return [];
    }
    
    if (!data) {
      console.log('No orders index found, returning empty array');
      return [];
    }
    
    const text = await data.text();
    const orders = JSON.parse(text);
    
    console.log(`Successfully fetched ${orders.length} orders from Supabase`);
    return orders;
  } catch (error) {
    console.error('Error fetching orders index:', error);
    return [];
  }
}

// Update orders index
export async function updateOrdersIndex(orderData: OrderData): Promise<void> {
  try {
    const existingOrders = await getOrdersFromSupabase();
    
    // Remove existing order if updating
    const filteredOrders = existingOrders.filter(order => order.orderId !== orderData.orderId);
    
    // Add new order to index
    const orderIndexItem: OrderIndexItem = {
      orderId: orderData.orderId,
      customerEmail: orderData.customerInfo.email,
      customerName: `${orderData.customerInfo.firstName} ${orderData.customerInfo.lastName}`,
      total: orderData.totals.total,
      currency: orderData.totals.currency,
      status: orderData.status,
      createdAt: orderData.createdAt,
      userId: orderData.userId
    };
    
    const updatedOrders = [...filteredOrders, orderIndexItem];
    
    // Save updated index
    const { error } = await supabaseAdmin.storage
      .from(BUCKETS.ORDERS)
      .upload('orders-index.json', JSON.stringify(updatedOrders, null, 2), {
        contentType: 'application/json',
        upsert: true
      });
    
    if (error) {
      throw new Error(`Failed to update orders index: ${error.message}`);
    }
    
  } catch (error) {
    console.error('Error updating orders index:', error);
    throw error;
  }
}

// ========================================
// USER PROFILE STORAGE FUNCTIONS
// ========================================

import { UserProfile } from '@/types/user';

// Save user profile to Supabase
export async function saveUserProfileToSupabase(userProfile: UserProfile): Promise<void> {
  try {
    const fileName = `${userProfile.email}.json`;
    
    const { error } = await supabaseAdmin.storage
      .from(BUCKETS.PROFILES)
      .upload(fileName, JSON.stringify(userProfile, null, 2), {
        contentType: 'application/json',
        upsert: true
      });
    
    // If bucket doesn't exist, create it and try again
    if (error && error.message.includes('Bucket not found')) {
      console.log('Profiles bucket not found, creating it...');
      
      const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKETS.PROFILES, {
        public: false
      });
      
      if (createError) {
        console.error('Error creating profiles bucket:', createError);
        throw new Error(`Failed to create profiles bucket: ${createError.message}`);
      }
      
      console.log('Profiles bucket created successfully, retrying upload...');
      
      // Retry the upload
      const { error: retryError } = await supabaseAdmin.storage
        .from(BUCKETS.PROFILES)
        .upload(fileName, JSON.stringify(userProfile, null, 2), {
          contentType: 'application/json',
          upsert: true
        });
      
      if (retryError) {
        console.error('Error saving profile to Supabase after bucket creation:', retryError);
        throw new Error(`Failed to save profile after bucket creation: ${retryError.message}`);
      }
    } else if (error) {
      console.error('Error saving profile to Supabase:', error);
      throw new Error(`Failed to save profile: ${error.message}`);
    }
    
    console.log(`Profile for ${userProfile.email} saved successfully to Supabase`);
  } catch (error) {
    console.error('Error in saveUserProfileToSupabase:', error);
    throw error;
  }
}

// Get user profile from Supabase
export async function getUserProfileFromSupabase(email: string): Promise<UserProfile | null> {
  try {
    const fileName = `${email}.json`;
    
    console.log(`Attempting to fetch profile for: ${email} from file: ${fileName}`);
    
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKETS.PROFILES)
      .download(fileName);
    
    if (error) {
      // Log the specific error details
      console.log(`Profile fetch error for ${email}:`, {
        name: error.name,
        message: error.message,
        status: 'status' in error ? error.status : 'no status',
        statusCode: 'statusCode' in error ? error.statusCode : 'no statusCode'
      });
      
      // Check for various "not found" error conditions
      const errorStr = JSON.stringify(error);
      const hasOriginalError = 'originalError' in error && error.originalError && typeof error.originalError === 'object' && 'status' in error.originalError;
      const originalStatus = hasOriginalError ? (error.originalError as { status: number }).status : null;
      
      if (error.message.includes('Object not found') || 
          error.message.includes('Not found') ||
          error.message.includes('does not exist') ||
          error.message.includes('Bucket not found') ||
          error.name === 'StorageUnknownError' ||
          errorStr.includes('StorageUnknownError') ||
          errorStr.includes('"statusCode":"404"') ||
          errorStr.includes('"status":404') ||
          errorStr.includes('__isStorageError') ||
          originalStatus === 400) { // 400 Bad Request often means bucket doesn't exist
        console.log(`No profile found for user: ${email} (bucket may not exist yet)`);
        return null;
      }
      console.error('Profile fetch error details:', error);
      throw new Error(`Failed to get profile: ${errorStr}`);
    }
    
    const profileText = await data.text();
    console.log(`Profile text retrieved for ${email}:`, profileText.substring(0, 200) + '...');
    
    const userProfile: UserProfile = JSON.parse(profileText);
    
    console.log(`Profile retrieved for user: ${email}`, { 
      hasShipping: !!userProfile.shippingAddress,
      hasBilling: !!userProfile.billingAddress 
    });
    return userProfile;
  } catch (error) {
    console.error('Error getting user profile from Supabase:', error);
    return null;
  }
}