import { NextRequest, NextResponse } from 'next/server';
import {
  getCategoriesFromSupabase,
  saveCategoriesToSupabase,
  buildCategoryTree,
  initializeDefaultCategories,
  type Category,
} from '@/lib/supabase-storage';

// Helper function to generate slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// GET /api/categories - Get all categories in hierarchical structure
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format'); // 'tree' or 'flat'
    const initDefaults = searchParams.get('initDefaults'); // 'true' to initialize defaults

    // Initialize default categories if requested
    if (initDefaults === 'true') {
      await initializeDefaultCategories();
    }

    const categories = await getCategoriesFromSupabase();

    let response;
    if (format === 'tree') {
      const categoryTree = buildCategoryTree(categories);
      response = NextResponse.json(categoryTree);
    } else {
      // Return flat list by default
      response = NextResponse.json(categories);
    }

    // Disable all caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

// POST /api/categories - Create a new category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, parentId } = body;

    // Validate required fields
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    // Generate slug from name
    const slug = generateSlug(name);

    // Validate slug uniqueness
    const categories = await getCategoriesFromSupabase();
    const existingSlug = categories.find((cat: Category) => cat.slug === slug);
    if (existingSlug) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      );
    }

    // Create the category
    const newCategory: Category = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      description: description?.trim() || undefined,
      parentId: parentId || null,
      slug,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add to categories array and save
    const updatedCategories = [...categories, newCategory];
    await saveCategoriesToSupabase(updatedCategories);
    
    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    
    // Handle validation errors from createCategory function
    if (error instanceof Error && error.message.includes('already exists') || 
        error instanceof Error && error.message.includes('more than 2 levels') ||
        error instanceof Error && error.message.includes('Parent category not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}