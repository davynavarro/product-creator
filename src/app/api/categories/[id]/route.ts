import { NextRequest, NextResponse } from 'next/server';
import {
  getCategoriesFromBlob,
  updateCategory,
  deleteCategory,
  getCategoryPath,
} from '@/lib/blob-storage';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// GET /api/categories/[id] - Get a specific category
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const categories = await getCategoriesFromBlob();
    const category = categories.find(cat => cat.id === id);

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Add computed fields
    const categoryWithPath = {
      ...category,
      path: getCategoryPath(categories, category.id),
    };

    return NextResponse.json(categoryWithPath);
  } catch (error) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

// PUT /api/categories/[id] - Update a category
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, parentId, isActive } = body;

    // Validate inputs
    if (name !== undefined && (!name || typeof name !== 'string')) {
      return NextResponse.json(
        { error: 'Invalid category name' },
        { status: 400 }
      );
    }

    const updates: Partial<{
      name: string;
      description: string | undefined;
      parentId: string | null;
      isActive: boolean;
      slug: string;
    }> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || undefined;
    if (parentId !== undefined) updates.parentId = parentId;
    if (isActive !== undefined) updates.isActive = isActive;

    // Generate new slug if name is being updated
    if (updates.name) {
      updates.slug = updates.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }

    const updatedCategory = await updateCategory(id, updates);
    
    return NextResponse.json(updatedCategory);
  } catch (error) {
    console.error('Error updating category:', error);
    
    if (error instanceof Error && (
        error.message.includes('not found') ||
        error.message.includes('already exists') ||
        error.message.includes('more than 2 levels')
    )) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('not found') ? 404 : 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

// DELETE /api/categories/[id] - Delete a category
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    const handleProducts = searchParams.get('handleProducts') as 'reassign' | 'uncategorized' | null;
    const targetCategoryId = searchParams.get('targetCategoryId');

    const options: {
      handleProducts?: 'reassign' | 'uncategorized';
      targetCategoryId?: string;
    } = {};
    if (handleProducts) {
      options.handleProducts = handleProducts;
      if (handleProducts === 'reassign' && targetCategoryId) {
        options.targetCategoryId = targetCategoryId;
      }
    }

    await deleteCategory(id, options);
    
    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    
    if (error instanceof Error && (
        error.message.includes('not found') ||
        error.message.includes('Cannot delete category') ||
        error.message.includes('subcategories') ||
        error.message.includes('products')
    )) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('not found') ? 404 : 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}