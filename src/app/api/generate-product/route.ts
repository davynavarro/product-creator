import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
  defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION },
  defaultHeaders: {
    'api-key': process.env.AZURE_OPENAI_API_KEY,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { productBrief, imageName } = await request.json();

    if (!productBrief) {
      return NextResponse.json({ error: 'Product brief is required' }, { status: 400 });
    }

    const systemPrompt = `You are a professional product marketing expert. Based on the product brief provided, generate comprehensive product details for an e-commerce product page. 

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
  "category": "Product category",
  "tags": ["tag1", "tag2", "tag3"]
}

Make the content engaging, professional, and sales-focused. Be specific and detailed based on the product brief. Only include the regular price - no discounts or sale prices.`;

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

    return NextResponse.json({
      success: true,
      productData
    });

  } catch (error) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate product details' },
      { status: 500 }
    );
  }
}