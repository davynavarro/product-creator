# AI Category Mapping Specification

## Overview
The AI Category Mapping capability enhances the product generation workflow to automatically assign products to appropriate categories from the structured category system stored in blob storage.

## Requirements

### AI Category Selection Integration

#### Requirement: Category Data Fetching
The system shall fetch available categories from blob storage before generating product data to ensure AI has current category options.

#### Scenario: Successful category retrieval during product generation
- **Given** a user initiates product generation with a product brief
- **When** the system begins the AI generation process
- **Then** the system fetches the current category hierarchy from blob storage
- **And** provides the category structure to the AI for selection
- **And** proceeds with product generation including category assignment

#### Scenario: Category service unavailable during generation
- **Given** the category service is unavailable or returns an error
- **When** the system attempts to fetch categories for AI generation
- **Then** the system falls back to a cached category list or predefined defaults
- **And** logs the service issue for monitoring
- **And** continues product generation with available category options

#### Scenario: Empty category system during generation
- **Given** no categories exist in the blob storage system
- **When** the system fetches categories for AI generation
- **Then** the system initializes default categories automatically
- **And** uses the newly created categories for AI selection
- **And** logs the initialization event for audit purposes

### AI-Powered Category Assignment

#### Requirement: Intelligent Category Mapping
The AI shall analyze product characteristics and assign the most appropriate category based on available options.

#### Scenario: Product mapped to subcategory
- **Given** a product brief describes "wireless bluetooth headphones with noise cancellation"
- **When** the AI generates product data with available categories
- **Then** the system assigns the product to "Audio & Headphones" subcategory
- **And** sets categoryId to the appropriate category ID
- **And** sets categoryPath to "Electronics > Audio & Headphones"
- **And** includes category assignment confidence in generation metadata

#### Scenario: Product mapped to parent category
- **Given** a product brief describes "general electronics starter kit"
- **When** no specific subcategory is appropriate for the product
- **Then** the system assigns the product to the parent "Electronics" category
- **And** sets appropriate categoryId and categoryPath
- **And** provides reasoning for the parent-level categorization

#### Scenario: Ambiguous product categorization
- **Given** a product brief describes "smart fitness water bottle with temperature control"
- **When** the product could fit multiple categories (Health & Beauty, Sports & Recreation, Electronics)
- **Then** the AI selects the most primary category based on product focus
- **And** provides categorization confidence score
- **And** logs the decision reasoning for potential review

#### Scenario: Novel product type categorization
- **Given** a product brief describes a completely new product type not clearly fitting existing categories
- **When** the AI cannot confidently map to existing categories
- **Then** the system assigns to the closest parent category
- **And** flags the product for potential new category creation
- **And** logs the novel product type for category system enhancement

### Category Assignment Validation

#### Requirement: Category Assignment Validation
All AI-generated products must have valid category assignments before saving.

#### Scenario: Valid category assignment validation
- **Given** an AI-generated product with categoryId and categoryPath
- **When** the system validates the category assignment
- **Then** the system confirms the categoryId exists in the current category system
- **And** verifies the categoryPath matches the category hierarchy
- **And** proceeds with product saving

#### Scenario: Invalid category assignment handling
- **Given** an AI-generated product with an invalid or non-existent categoryId
- **When** the system validates the category assignment
- **Then** the system rejects the invalid assignment
- **And** attempts to find the closest matching valid category
- **And** assigns a fallback category if no match is found
- **And** logs the validation failure for system improvement

#### Scenario: Missing category assignment handling
- **Given** an AI-generated product without categoryId or categoryPath
- **When** the system validates the product data
- **Then** the system attempts to infer category from the legacy category field
- **And** maps to structured categories using existing migration logic
- **And** assigns appropriate categoryId and categoryPath
- **And** logs the missing assignment for monitoring

### Performance and Caching

#### Requirement: Category Caching Strategy
The system shall implement caching to minimize performance impact of category fetching during product generation.

#### Scenario: Category data caching for performance
- **Given** categories are fetched for the first product generation request
- **When** subsequent product generation requests occur within the cache period
- **Then** the system uses cached category data without additional API calls
- **And** maintains cache validity for a reasonable period (5-10 minutes)
- **And** refreshes cache when category modifications are detected

#### Scenario: Cache invalidation on category changes
- **Given** cached category data exists in the system
- **When** categories are modified through the admin interface
- **Then** the system invalidates the category cache
- **And** fetches fresh category data for the next product generation
- **And** ensures all new products use the updated category structure

### API Enhancement

#### Requirement: Enhanced Product Generation API
The product generation API shall be enhanced to include category assignment without breaking existing functionality.

#### Scenario: Enhanced API response with category data
- **Given** a product generation request is processed successfully
- **When** the system returns the generated product data
- **Then** the response includes standard product fields (name, description, etc.)
- **And** includes categoryId for the assigned category
- **And** includes categoryPath for display purposes  
- **And** maintains backward compatibility with legacy category field
- **And** includes category assignment metadata (confidence, reasoning)

#### Scenario: API backward compatibility maintenance
- **Given** existing clients expect the legacy category field in responses
- **When** the enhanced API processes product generation requests
- **Then** the response includes both legacy category and new categoryId/categoryPath
- **And** existing client functionality remains unaffected
- **And** new clients can utilize the enhanced category information

## Data Model Enhancements

### AI Generation Request
```typescript
interface AIGenerationRequest {
  productBrief: string;
  imageUrl?: string;
  // Existing fields...
  
  // Category context for AI
  availableCategories?: Category[];
  categoryPreference?: string; // Optional user hint
  requireCategoryAssignment?: boolean; // Default: true
}
```

### Enhanced Product Generation Response
```typescript
interface EnhancedProductData {
  // Existing product fields...
  productName: string;
  tagline: string;
  description: string;
  keyFeatures: string[];
  specifications: Record<string, string>;
  pricing: PricingInfo;
  benefits: string[];
  targetAudience: string;
  tags: string[];
  
  // Legacy category (maintained for compatibility)
  category: string;
  
  // Enhanced category assignment
  categoryId: string;
  categoryPath: string;
  
  // Category assignment metadata
  categoryMetadata?: {
    confidence: number; // 0-1 score
    reasoning: string;
    alternativeCategories?: string[]; // Other considered categories
    isNovelProduct?: boolean; // Flag for new product types
  };
}
```

### Category Cache Structure
```typescript
interface CategoryCache {
  data: Category[];
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  version: string; // Category system version hash
}
```

## AI Prompt Enhancement

### Category Selection Prompt Template
```
Available Product Categories (2-level hierarchy):

{CATEGORY_TREE_FORMATTED}

Product Brief: {PRODUCT_BRIEF}

Please generate comprehensive product data and select the most appropriate category from the available options above. 

Category Selection Guidelines:
1. Choose the most specific subcategory when possible
2. Use parent category only if no subcategory fits well
3. Consider the primary function/purpose of the product
4. For multi-purpose products, select the most prominent use case

Required category fields in response:
- categoryId: The exact ID from the available categories
- categoryPath: The full hierarchical path (e.g., "Electronics > Smartphones & Tablets")
- categoryConfidence: Confidence score 0-1 for the selection
- categoryReasoning: Brief explanation for the category choice

{EXISTING_PRODUCT_GENERATION_INSTRUCTIONS}
```

## Performance Requirements

- Category fetching completes within 200ms for cached data
- Fresh category data loading completes within 500ms
- AI generation with category assignment adds no more than 300ms overhead
- Cache hit rate maintains above 80% during normal operation
- Category validation completes within 100ms per product

## Error Handling

- Graceful degradation when category service is unavailable
- Automatic fallback to cached or default categories
- Clear error messages for category assignment failures
- Comprehensive logging for debugging and system improvement
- User-friendly error reporting without exposing system internals

## Monitoring and Analytics

- Track category assignment accuracy and confidence scores
- Monitor AI category selection patterns for system optimization
- Log novel product types for potential category expansion
- Measure performance impact of category integration
- Alert on category service availability issues