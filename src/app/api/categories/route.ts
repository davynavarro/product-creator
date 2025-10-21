import { NextRequest, NextResponse } from 'next/server';
import {
  getCategoriesFromBlob,
  createCategory,
  buildCategoryTree,
  initializeDefaultCategories,
  generateSlug,
} from '@/lib/blob-storage';

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

    const categories = await getCategoriesFromBlob();

    if (format === 'tree') {
      const categoryTree = buildCategoryTree(categories);
      return NextResponse.json(categoryTree);
    }

    // Return flat list by default
    return NextResponse.json(categories);
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
    const categories = await getCategoriesFromBlob();
    const existingSlug = categories.find(cat => cat.slug === slug);
    if (existingSlug) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      );
    }

    // Create the category
    const categoryData = {
      name: name.trim(),
      description: description?.trim() || undefined,
      parentId: parentId || null,
      slug,
      isActive: true,
    };

    const newCategory = await createCategory(categoryData);
    
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