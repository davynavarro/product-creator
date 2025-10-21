'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Folder } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CategoryTree {
  category: Category;
  children: CategoryTree[];
  level: number;
}

interface CategorySelectorProps {
  value: string | null;
  onChange: (categoryId: string | null, categoryPath: string | null) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  className?: string;
}

export default function CategorySelector({ 
  value, 
  onChange, 
  placeholder = "Select category...", 
  allowEmpty = true,
  className = "" 
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryTree, setCategoryTree] = useState<CategoryTree[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<string>('');

  const loadCategories = async () => {
    try {
      // Load flat categories
      const flatResponse = await fetch('/api/categories?format=flat');
      if (flatResponse.ok) {
        const flatCategories = await flatResponse.json();
        setCategories(flatCategories);
      }

      // Load tree structure
      const treeResponse = await fetch('/api/categories?format=tree');
      if (treeResponse.ok) {
        const tree = await treeResponse.json();
        setCategoryTree(tree);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryPath = useCallback((category: Category): string => {
    if (category.parentId) {
      const parent = categories.find(cat => cat.id === category.parentId);
      if (parent) {
        return `${parent.name} > ${category.name}`;
      }
    }
    return category.name;
  }, [categories]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (value && categories.length > 0) {
      const category = categories.find(cat => cat.id === value);
      if (category) {
        const path = getCategoryPath(category);
        setSelectedCategoryPath(path);
      }
    } else {
      setSelectedCategoryPath('');
    }
  }, [value, categories, getCategoryPath]);

  const handleCategorySelect = (categoryId: string | null) => {
    let categoryPath = null;
    if (categoryId) {
      const category = categories.find(cat => cat.id === categoryId);
      if (category) {
        categoryPath = getCategoryPath(category);
      }
    }
    
    onChange(categoryId, categoryPath);
    setIsOpen(false);
  };

  const renderTreeOptions = (trees: CategoryTree[], level = 0) => {
    return trees.map((tree) => (
      <div key={tree.category.id}>
        <button
          type="button"
          onClick={() => handleCategorySelect(tree.category.id)}
          className={`w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center space-x-2 ${
            value === tree.category.id ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
          }`}
          style={{ paddingLeft: `${12 + (level * 20)}px` }}
        >
          <Folder className="w-4 h-4 text-gray-400" />
          <span className="flex-1">{tree.category.name}</span>
          {tree.level === 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              Parent
            </span>
          )}
        </button>
        {tree.children.length > 0 && renderTreeOptions(tree.children, level + 1)}
      </div>
    ));
  };

  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
          Loading categories...
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <span className={selectedCategoryPath ? 'text-gray-900' : 'text-gray-500'}>
          {selectedCategoryPath || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {allowEmpty && (
            <button
              type="button"
              onClick={() => handleCategorySelect(null)}
              className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${
                !value ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
              }`}
            >
              <span className="text-gray-500 italic">No category</span>
            </button>
          )}
          
          {categoryTree.length > 0 ? (
            renderTreeOptions(categoryTree)
          ) : (
            <div className="px-3 py-2 text-gray-500 italic">
              No categories available
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// Simple select version for basic use cases
export function SimpleCategorySelect({ 
  value, 
  onChange, 
  placeholder = "Select category...",
  allowEmpty = true,
  className = ""
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories?format=flat');
      if (response.ok) {
        const flatCategories = await response.json();
        setCategories(flatCategories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryPath = (categoryId: string): string => {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return '';
    
    if (category.parentId) {
      const parent = categories.find(cat => cat.id === category.parentId);
      if (parent) {
        return `${parent.name} > ${category.name}`;
      }
    }
    return category.name;
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const categoryId = e.target.value || null;
    const categoryPath = categoryId ? getCategoryPath(categoryId) : null;
    onChange(categoryId, categoryPath);
  };

  if (isLoading) {
    return (
      <select disabled className={`px-3 py-2 border border-gray-300 rounded-md bg-gray-50 ${className}`}>
        <option>Loading categories...</option>
      </select>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      className={`px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
    >
      {allowEmpty && <option value="">{placeholder}</option>}
      
      {categories
        .filter(cat => !cat.parentId) // Parent categories first
        .map(parent => (
          <optgroup key={parent.id} label={parent.name}>
            <option value={parent.id}>{parent.name}</option>
            {categories
              .filter(cat => cat.parentId === parent.id)
              .map(child => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))
            }
          </optgroup>
        ))
      }
    </select>
  );
}