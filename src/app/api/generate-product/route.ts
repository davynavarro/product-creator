import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  getCategoriesFromSupabase,
  buildCategoryTree,
  initializeDefaultCategories,
  getCategoryPath,
  type Category,
} from '@/lib/supabase-storage';

const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
  defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION },
  defaultHeaders: {
    'api-key': process.env.AZURE_OPENAI_API_KEY,
  },
});

// Fetch categories without caching
async function getCategories(): Promise<Category[]> {
  try {
    // Initialize default categories if needed
    await initializeDefaultCategories();
    
    // Fetch fresh categories every time
    const categories = await getCategoriesFromSupabase();
    return categories;
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return [];
  }
}

// Format category tree for AI prompt
function formatCategoriesForAI(categories: Category[]): string {
  const categoryTree = buildCategoryTree(categories);
  
  let formatted = 'Available Product Categories (2-level hierarchy):\n\n';
  
  categoryTree.forEach(parent => {
    formatted += `**${parent.category.name}** (ID: ${parent.category.id})\n`;
    if (parent.category.description) {
      formatted += `  Description: ${parent.category.description}\n`;
    }
    
    if (parent.children.length > 0) {
      parent.children.forEach(child => {
        formatted += `  - ${child.category.name} (ID: ${child.category.id})\n`;
        if (child.category.description) {
          formatted += `    Description: ${child.category.description}\n`;
        }
      });
    }
    formatted += '\n';
  });
  
  return formatted;
}

// Validate category assignment
function validateCategoryAssignment(categoryId: string, categories: Category[]): {
  isValid: boolean;
  category?: Category;
  categoryPath?: string;
} {
  if (!categoryId) {
    return { isValid: false };
  }
  
  const category = categories.find(cat => cat.id === categoryId);
  if (!category) {
    return { isValid: false };
  }
  
  const categoryPath = getCategoryPath(categories, categoryId);
  return {
    isValid: true,
    category,
    categoryPath,
  };
}

// Find fallback category based on product characteristics
function findFallbackCategory(productDescription: string, categories: Category[]): Category | null {
  const description = productDescription.toLowerCase();
  
  // Define mapping keywords to category patterns
  const categoryMappings = [
    { keywords: ['phone', 'smartphone', 'mobile', 'iphone', 'android'], categoryNames: ['smartphones & tablets'] },
    { keywords: ['laptop', 'computer', 'pc', 'desktop'], categoryNames: ['computers & laptops'] },
    { keywords: ['headphone', 'earphone', 'speaker', 'audio'], categoryNames: ['audio & headphones'] },
    { keywords: ['smart home', 'iot', 'automation'], categoryNames: ['smart home & iot'] },
    { keywords: ['game', 'gaming', 'console'], categoryNames: ['gaming & entertainment'] },
    { keywords: ['clothing', 'shirt', 'dress', 'pants'], categoryNames: ['clothing & fashion'] },
    { keywords: ['shoes', 'sneaker', 'boot', 'footwear'], categoryNames: ['shoes & footwear'] },
    { keywords: ['furniture', 'chair', 'table', 'desk'], categoryNames: ['furniture & decor'] },
    { keywords: ['kitchen', 'cookware', 'appliance'], categoryNames: ['kitchen & dining'] },
    { keywords: ['fitness', 'exercise', 'workout', 'gym'], categoryNames: ['fitness equipment'] },
    { keywords: ['beauty', 'skincare', 'cosmetic'], categoryNames: ['skincare & cosmetics'] },
  ];
  
  // Try to find matching category
  for (const mapping of categoryMappings) {
    if (mapping.keywords.some(keyword => description.includes(keyword))) {
      for (const categoryName of mapping.categoryNames) {
        const category = categories.find(cat => 
          cat.name.toLowerCase().includes(categoryName.toLowerCase())
        );
        if (category) {
          return category;
        }
      }
    }
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { productBrief, imageName } = await request.json();

    if (!productBrief) {
      return NextResponse.json({ error: 'Product brief is required' }, { status: 400 });
    }

    // Fetch categories for AI context
    const categories = await getCategories();
    const categoryContext = formatCategoriesForAI(categories);

    const systemPrompt = `You are a professional product marketing expert. Based on the product brief provided, generate comprehensive product details for an e-commerce product page.

${categoryContext}

IMPORTANT - Category Selection Requirements:
1. You MUST select the most appropriate category from the available categories above
2. Use the exact categoryId from the list (e.g., "cat_electronics_smartphones")
3. Choose the most specific subcategory when possible
4. Use parent category only if no subcategory fits well
5. Consider the primary function/purpose of the product
6. For multi-purpose products, select the most prominent use case

Return a JSON object with the following structure:
{
  "productName": "Clear, compelling product name",
  "tagline": "Short catchy tagline (max 60 characters)",
  "description": "Detailed product description (2-3 paragraphs)",
  "keyFeatures": ["Feature 1", "Feature 2", "Feature 3", "Feature 4"],
  "specifications": {
    "Dimensions": "value",
    "Weight": "value",
    "Material": "value",
    "Color": "value"
  },
  "pricing": {
    "currency": "USD",
    "price": 99.99
  },
  "benefits": ["Benefit 1", "Benefit 2", "Benefit 3"],
  "targetAudience": "Description of ideal customer",
  "category": "Legacy category name for compatibility",
  "categoryId": "REQUIRED: Exact category ID from the available categories above",
  "categoryConfidence": 0.95,
  "categoryReasoning": "Brief explanation for why this category was selected",
  "tags": ["tag1", "tag2", "tag3"]
}

Make the content engaging, professional, and sales-focused. Be specific and detailed based on the product brief. Only include the regular price - no discounts or sale prices.

CRITICAL: You must include a valid categoryId from the available categories list above.`;

    const userPrompt = `Product Brief: ${productBrief}${imageName ? `\nImage: ${imageName}` : ''}

Generate professional product details for this item.`;

    const response = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let productData;
    try {
      productData = JSON.parse(content);
    } catch {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Invalid response format from AI');
    }

    // Validate and enhance category assignment
    let categoryValidation: {
      isValid: boolean;
      category?: Category;
      categoryPath?: string;
    } = { isValid: false };
    
    if (productData.categoryId) {
      categoryValidation = validateCategoryAssignment(productData.categoryId, categories);
    }

    // Handle invalid or missing category assignment
    if (!categoryValidation.isValid) {
      console.log('Invalid category assignment, attempting fallback mapping');
      
      // Try to find a fallback category based on the legacy category field or product name
      const fallbackCategory = findFallbackCategory(
        productData.category || productData.productName || '',
        categories
      );
      
      if (fallbackCategory) {
        categoryValidation = validateCategoryAssignment(fallbackCategory.id, categories);
        productData.categoryId = fallbackCategory.id;
        productData.categoryConfidence = 0.5; // Lower confidence for fallback
        productData.categoryReasoning = `Fallback mapping: AI selection invalid, mapped based on product characteristics`;
      } else {
        // Last resort: assign to a default parent category
        const defaultCategory = categories.find(cat => !cat.parentId); // First parent category
        if (defaultCategory) {
          categoryValidation = validateCategoryAssignment(defaultCategory.id, categories);
          productData.categoryId = defaultCategory.id;
          productData.categoryConfidence = 0.2; // Very low confidence
          productData.categoryReasoning = `Default assignment: Could not determine appropriate category`;
        }
      }
    }

    // Add enhanced category information to response
    const enhancedProductData = {
      ...productData,
      categoryPath: categoryValidation.categoryPath,
      categoryMetadata: {
        confidence: productData.categoryConfidence || 0.8,
        reasoning: productData.categoryReasoning || 'AI category selection',
        isNovelProduct: productData.categoryConfidence < 0.7,
        assignmentMethod: categoryValidation.isValid ? 'ai_primary' : 'fallback'
      }
    };

    // Ensure backward compatibility by keeping legacy category field
    if (!enhancedProductData.category && categoryValidation.isValid && categoryValidation.category) {
      enhancedProductData.category = categoryValidation.category.name;
    }

    const apiResponse = NextResponse.json({
      success: true,
      productData: enhancedProductData
    });

    // Disable all caching
    apiResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    apiResponse.headers.set('Pragma', 'no-cache');
    apiResponse.headers.set('Expires', '0');
    apiResponse.headers.set('Surrogate-Control', 'no-store');

    return apiResponse;

  } catch (error) {
    console.error('AI generation error:', error);
    console.error('Environment check:', {
      hasApiKey: !!process.env.AZURE_OPENAI_API_KEY,
      hasEndpoint: !!process.env.AZURE_OPENAI_ENDPOINT,
      hasDeployment: !!process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      hasVersion: !!process.env.AZURE_OPENAI_API_VERSION
    });
    return NextResponse.json(
      { error: 'Failed to generate product details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}