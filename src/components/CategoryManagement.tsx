'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  Save, 
  X,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  productCount?: number;
}

interface CategoryTree {
  category: Category;
  children: CategoryTree[];
  level: number;
}

export default function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryTree[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Migration state
  const [migrationStatus, setMigrationStatus] = useState<{
    totalProducts: number;
    migratedProducts: number;
    unmappedProducts: number;
    needsMigration: boolean;
  } | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showMigration, setShowMigration] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parentId: '' as string | null,
  });

  useEffect(() => {
    loadCategories();
    loadMigrationStatus();
  }, []);

  const loadMigrationStatus = async () => {
    try {
      const response = await fetch('/api/migrate-categories');
      if (response.ok) {
        const data = await response.json();
        setMigrationStatus(data.stats);
        setShowMigration(data.needsMigration);
      }
    } catch (err) {
      console.error('Error loading migration status:', err);
    }
  };

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      
      // Initialize defaults if needed
      const response = await fetch('/api/categories?format=flat&initDefaults=true');
      if (!response.ok) throw new Error('Failed to load categories');
      
      const flatCategories = await response.json();
      setCategories(flatCategories);

      // Get tree structure
      const treeResponse = await fetch('/api/categories?format=tree');
      if (!treeResponse.ok) throw new Error('Failed to load category tree');
      
      const tree = await treeResponse.json();
      setCategoryTree(tree);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleCreate = () => {
    setFormData({ name: '', description: '', parentId: null });
    setEditingCategory(null);
    setShowCreateForm(true);
    setError(null);
  };

  const handleEdit = (category: Category) => {
    setFormData({
      name: category.name,
      description: category.description || '',
      parentId: category.parentId || null,
    });
    setEditingCategory(category);
    setShowCreateForm(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        parentId: formData.parentId || null,
      };

      let response;
      if (editingCategory) {
        response = await fetch(`/api/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save category');
      }

      setMessage(editingCategory ? 'Category updated successfully' : 'Category created successfully');
      setShowCreateForm(false);
      setEditingCategory(null);
      await loadCategories();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    }
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/categories/${category.id}?handleProducts=uncategorized`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete category');
      }

      setMessage('Category deleted successfully');
      await loadCategories();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  const handleMigration = async (dryRun = false) => {
    setIsMigrating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/migrate-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Migration failed');
      }

      const result = await response.json();
      setMessage(result.message);
      
      if (!dryRun) {
        await loadMigrationStatus();
        await loadCategories();
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run migration');
    } finally {
      setIsMigrating(false);
    }
  };

  const renderCategoryTree = (trees: CategoryTree[]) => {
    return trees.map((tree) => (
      <div key={tree.category.id} className="border-b border-gray-100 last:border-0">
        <div className="flex items-center justify-between p-4 hover:bg-gray-50">
          <div className="flex items-center space-x-3 flex-1">
            {tree.children.length > 0 && (
              <button
                onClick={() => toggleExpanded(tree.category.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                {expandedCategories.has(tree.category.id) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
            
            {tree.children.length > 0 ? (
              expandedCategories.has(tree.category.id) ? (
                <FolderOpen className="w-5 h-5 text-blue-500" />
              ) : (
                <Folder className="w-5 h-5 text-blue-500" />
              )
            ) : (
              <div className="w-5 h-5" />
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-medium text-gray-900">{tree.category.name}</h3>
                {tree.level > 0 && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    Subcategory
                  </span>
                )}
              </div>
              {tree.category.description && (
                <p className="text-sm text-gray-500 mt-1">{tree.category.description}</p>
              )}
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                <span>ID: {tree.category.id}</span>
                <span>Slug: {tree.category.slug}</span>
                <span>Products: {tree.category.productCount || 0}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleEdit(tree.category)}
              className="text-blue-600 hover:text-blue-800 p-1"
              title="Edit category"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(tree.category)}
              className="text-red-600 hover:text-red-800 p-1"
              title="Delete category"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {expandedCategories.has(tree.category.id) && tree.children.length > 0 && (
          <div className="ml-8 border-l-2 border-gray-100">
            {renderCategoryTree(tree.children)}
          </div>
        )}
      </div>
    ));
  };

  const parentCategories = categories.filter(cat => !cat.parentId);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Category Management</h2>
            <p className="text-sm text-gray-500 mt-1">
              Organize products with a 2-level category hierarchy
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Migration Section */}
      {showMigration && migrationStatus && (
        <div className="mx-6 mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-yellow-900 mb-2">
                Category Migration Required
              </h3>
              <p className="text-sm text-yellow-800 mb-3">
                {migrationStatus.unmappedProducts} of {migrationStatus.totalProducts} products need to be migrated to the new category system.
              </p>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleMigration(true)}
                  disabled={isMigrating}
                  className="text-sm bg-yellow-100 text-yellow-800 px-3 py-2 rounded-md hover:bg-yellow-200 disabled:opacity-50 flex items-center space-x-2"
                >
                  {isMigrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                  <span>Preview Migration</span>
                </button>
                <button
                  onClick={() => handleMigration(false)}
                  disabled={isMigrating}
                  className="text-sm bg-yellow-600 text-white px-3 py-2 rounded-md hover:bg-yellow-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  {isMigrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Run Migration</span>
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowMigration(false)}
              className="text-yellow-600 hover:text-yellow-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">{message}</p>
          <button 
            onClick={() => setMessage(null)}
            className="float-right text-green-600 hover:text-green-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="mx-6 my-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-4">
            {editingCategory ? 'Edit Category' : 'Create New Category'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter category name"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Optional category description"
                rows={2}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent Category
              </label>
              <select
                value={formData.parentId || ''}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">None (Top-level category)</option>
                {parentCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{editingCategory ? 'Update' : 'Create'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingCategory(null);
                  setError(null);
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Tree */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading categories...</span>
          </div>
        ) : categoryTree.length > 0 ? (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {renderCategoryTree(categoryTree)}
          </div>
        ) : (
          <div className="text-center py-12">
            <Folder className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No categories yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first category to start organizing products
            </p>
            <button
              onClick={handleCreate}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create First Category
            </button>
          </div>
        )}
      </div>
    </div>
  );
}