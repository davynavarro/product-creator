# Category Management Capability Specification

## Overview
The category management capability provides administrators with the ability to create, organize, and maintain a 2-level hierarchical category structure for product classification and organization.

## Requirements

### Category Data Model

#### Requirement: 2-Level Category Hierarchy
The system shall support a maximum 2-level category hierarchy with parent categories and optional subcategories.

#### Scenario: Parent category creation
- **Given** an administrator accesses the category management interface
- **When** creating a new top-level category
- **Then** the system creates a parent category with no parent reference
- **And** the category is available for subcategory creation and product assignment

#### Scenario: Subcategory creation
- **Given** a parent category exists in the system
- **When** an administrator creates a subcategory under the parent
- **Then** the system creates the subcategory linked to the parent category
- **And** the hierarchy depth does not exceed 2 levels

#### Scenario: Hierarchy depth validation
- **Given** a subcategory exists in the system
- **When** an administrator attempts to create a category under the subcategory
- **Then** the system prevents the creation and displays an error
- **And** maintains the 2-level hierarchy limit

### Category CRUD Operations

#### Requirement: Create Categories
Administrators shall be able to create new parent categories and subcategories through the admin interface.

#### Scenario: Create parent category
- **Given** an administrator is on the category management page
- **When** creating a new category with name, description, and no parent
- **Then** the system creates the parent category with a unique identifier
- **And** validates the category name is unique among siblings
- **And** displays the new category in the management interface

#### Scenario: Create subcategory
- **Given** a parent category exists
- **When** an administrator creates a subcategory with valid parent selection
- **Then** the system creates the subcategory linked to the specified parent
- **And** validates uniqueness within the parent's children
- **And** updates the category hierarchy display

#### Scenario: Category name validation
- **Given** existing categories in the system
- **When** creating a category with a duplicate name at the same level
- **Then** the system prevents creation and shows a validation error
- **And** suggests alternative names or allows modification

#### Requirement: Read Categories
The system shall display categories in a hierarchical tree structure for browsing and management.

#### Scenario: Display category hierarchy
- **Given** categories exist in the system
- **When** an administrator views the category management page
- **Then** categories are displayed in a tree structure showing parent-child relationships
- **And** each category shows its name, description, and product count
- **And** the interface allows expansion/collapse of parent categories

#### Scenario: Category details view
- **Given** a specific category in the system
- **When** an administrator selects a category for detailed view
- **Then** the system displays category name, description, parent (if applicable), and associated products
- **And** provides options to edit or delete the category

#### Requirement: Update Categories
Administrators shall be able to modify category names, descriptions, and parent relationships within hierarchy constraints.

#### Scenario: Edit category information
- **Given** an existing category in the system
- **When** an administrator updates the category name or description
- **Then** the system validates the changes against naming rules
- **And** updates the category while preserving relationships
- **And** reflects changes across all product assignments

#### Scenario: Move category in hierarchy
- **Given** a subcategory exists in the system
- **When** an administrator changes its parent to another valid parent category
- **Then** the system moves the subcategory maintaining hierarchy rules
- **And** updates all affected product categorizations
- **And** prevents moves that would violate the 2-level limit

#### Scenario: Convert between parent and subcategory
- **Given** a parent category with no children
- **When** an administrator assigns it to another parent category
- **Then** the system converts it to a subcategory if hierarchy allows
- **And** updates the category structure and product assignments

#### Requirement: Delete Categories
Administrators shall be able to remove categories with appropriate safeguards for data integrity.

#### Scenario: Delete empty category
- **Given** a category with no associated products or subcategories
- **When** an administrator deletes the category
- **Then** the system removes the category from the hierarchy
- **And** updates the category management interface
- **And** removes the category from all selection interfaces

#### Scenario: Delete category with subcategories
- **Given** a parent category with subcategories
- **When** an administrator attempts to delete the parent category
- **Then** the system presents options to handle subcategories (promote, move, or cascade delete)
- **And** requires explicit confirmation for the chosen action
- **And** executes the deletion with the selected subcategory handling

#### Scenario: Delete category with products
- **Given** a category assigned to one or more products
- **When** an administrator attempts to delete the category
- **Then** the system shows the impact (number of affected products)
- **And** provides options to reassign products or move them to "Uncategorized"
- **And** requires confirmation before proceeding with deletion

### Product-Category Integration

#### Requirement: Category Assignment
Products shall be assigned to categories during creation and editing processes.

#### Scenario: Category selection during product creation
- **Given** the product creation interface
- **When** a user is creating a new product
- **Then** the system displays available categories in a hierarchical selector
- **And** allows selection of either parent or subcategory
- **And** validates the selected category exists and is active

#### Scenario: Product category editing
- **Given** an existing product with a category assignment
- **When** editing the product category
- **Then** the system shows current category and allows selection of a new one
- **And** updates the product's category assignment
- **And** reflects changes in category-based filtering and organization

#### Scenario: Bulk product categorization
- **Given** multiple products requiring category assignment
- **When** an administrator performs bulk category updates
- **Then** the system applies the category to all selected products
- **And** validates each assignment against category constraints
- **And** provides feedback on successful and failed assignments

### Default Categories Structure

#### Requirement: Initial Category Setup
The system shall provide a default set of common e-commerce categories upon initial setup.

#### Scenario: System initialization with default categories
- **Given** a fresh installation of the category management system
- **When** the system initializes for the first time
- **Then** default parent categories are created (Electronics, Clothing, Home & Garden, Health & Beauty, Sports & Recreation)
- **And** common subcategories are created under appropriate parents
- **And** all categories are immediately available for product assignment

## Data Model

### Category Entity
```typescript
interface Category {
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
```

### Category Tree Structure
```typescript
interface CategoryTree {
  category: Category;
  children: CategoryTree[];
  level: number; // 0 for parent, 1 for subcategory
}
```

### Product Category Assignment (Updated)
```typescript
interface ProductIndexItem {
  id: string;
  productName: string;
  slug: string;
  category: string; // Legacy field for backward compatibility
  categoryId?: string; // New structured category reference
  categoryPath?: string; // Full category path (e.g., "Electronics > Smartphones")
  createdAt: string;
  imageUrl: string;
  pricing: {
    currency: string;
    price: number;
    originalPrice?: number;
    discount?: string;
  };
}
```

## Default Category Structure

### Electronics
- Smartphones & Tablets
- Computers & Laptops  
- Audio & Headphones
- Smart Home & IoT
- Gaming & Entertainment

### Clothing & Fashion
- Men's Clothing
- Women's Clothing
- Shoes & Footwear
- Accessories & Jewelry
- Bags & Luggage

### Home & Garden
- Furniture & Decor
- Kitchen & Dining
- Cleaning & Organization
- Garden & Outdoor
- Tools & Hardware

### Health & Beauty
- Skincare & Cosmetics
- Health & Wellness
- Personal Care
- Vitamins & Supplements
- Medical & Mobility

### Sports & Recreation
- Fitness Equipment
- Outdoor Sports
- Team Sports
- Water Sports
- Exercise & Yoga

## API Endpoints

### GET /api/categories
Returns hierarchical list of all active categories.

**Response:**
- `200 OK`: Array of CategoryTree objects
- `500 Error`: Server error retrieving categories

### POST /api/categories
Creates a new category with validation.

**Request Body:**
```json
{
  "name": "Category Name",
  "description": "Optional description",
  "parentId": "optional-parent-id"
}
```

**Response:**
- `201 Created`: Category object with generated ID
- `400 Bad Request`: Validation errors
- `409 Conflict`: Duplicate name at same level

### PUT /api/categories/:id
Updates existing category information.

**Response:**
- `200 OK`: Updated category object
- `400 Bad Request`: Validation errors
- `404 Not Found`: Category not found

### DELETE /api/categories/:id
Deletes category with impact validation.

**Query Parameters:**
- `handleProducts`: "reassign" | "uncategorized" | "prevent"
- `handleSubcategories`: "promote" | "move" | "cascade"

**Response:**
- `200 OK`: Deletion confirmation and affected items count
- `400 Bad Request`: Cannot delete due to dependencies
- `404 Not Found`: Category not found

## Performance Requirements

- Category tree loading completes within 500ms for up to 100 categories
- Category CRUD operations complete within 200ms
- Product category assignment updates within 100ms
- Bulk operations handle up to 50 products within 2 seconds

## Validation Rules

- Category names must be unique within the same parent level
- Maximum 2-level hierarchy depth enforced
- Category names: 1-50 characters, alphanumeric and common symbols
- Descriptions: optional, maximum 200 characters
- Cannot delete categories with active product assignments without explicit handling
- Cannot create circular parent-child relationships