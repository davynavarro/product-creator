// AI Chat API route: /app/api/ai-chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { 
  AIShoppingEngine,
  StripePaymentProvider,
  createAIShoppingConfig,
  USTaxProvider,
  TieredShippingProvider,
  type ProductProvider,
  type CartProvider,
  type ProfileProvider
} from '../../../../lib/ai-shopping-assistant';

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// Interface for your API's product format
interface APIProduct {
  id: string;
  productName: string;
  description?: string;
  tagline?: string;
  pricing?: {
    price: number;
  };
  category?: string;
  imageUrl?: string;
  specifications?: Record<string, string | number | boolean>;
}

// Server-side providers that use your existing APIs
class ServerProductProvider implements ProductProvider {
  async search(query: string, options?: { category?: string; limit?: number }) {
    const response = await fetch(`${baseUrl}/api/search?q=${encodeURIComponent(query)}&limit=${options?.limit || 10}`);
    const data = await response.json();
    
    // Map your API response to the expected Product interface
    return (data.results || []).map((product: APIProduct) => ({
      id: product.id,
      name: product.productName, // Map productName to name
      description: product.description || product.tagline || '',
      price: product.pricing?.price || 0,
      category: product.category || '',
      imageUrl: product.imageUrl,
      specifications: product.specifications || {}
    }));
  }
}

class ServerCartProvider implements CartProvider {
  async getCart(sessionId: string) {
    console.log("Fetching cart for session:", sessionId);
    const response = await fetch(`${baseUrl}/api/cart?sessionId=${sessionId}`);
    return await response.json();
  }

  async addItems(sessionId: string, items: Array<{ productId: string; quantity: number }>) {
    
    // Get all products and find the ones we need by ID
    const productsResponse = await fetch(`${baseUrl}/api/products`);
    const allProducts: APIProduct[] = await productsResponse.json();
    
    const cartItems = [];
    for (const item of items) {
      const product = allProducts.find((p: APIProduct) => p.id === item.productId);
      if (product && product.pricing) {
        cartItems.push({
          id: item.productId,
          productName: product.productName,
          price: product.pricing.price,
          quantity: item.quantity,
          imageUrl: product.imageUrl,
          addedAt: new Date().toISOString()
        });
      }
    }
    
    const response = await fetch(`${baseUrl}/api/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, items: cartItems })
    });
    return await response.json();
  }

  async removeItems(sessionId: string, items: Array<{ productId: string; quantity?: number; removeAll?: boolean }>) {
    const response = await fetch(`${baseUrl}/api/cart`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, items })
    });
    return await response.json();
  }

  async clearCart(sessionId: string) {
    const response = await fetch(`${baseUrl}/api/cart`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    return await response.json();
  }
}

class ServerProfileProvider implements ProfileProvider {
  async getShippingAddress(userEmail: string) {
    const response = await fetch(`${baseUrl}/api/profile?userEmail=${encodeURIComponent(userEmail)}`);
    if (!response.ok) return null;
    const profile = await response.json();
    return profile.profile?.shippingAddress || null;
  }
}

// Create AI engine with server-side secrets
const aiConfig = createAIShoppingConfig({
  azureOpenAI: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4'
  },
  productProvider: new ServerProductProvider(),
  cartProvider: new ServerCartProvider(),
  paymentProvider: new StripePaymentProvider(process.env.STRIPE_SECRET_KEY!),
  profileProvider: new ServerProfileProvider(),
  orderCalculations: {
    currency: 'USD',
    taxProvider: new USTaxProvider(), // State-based tax calculation
    shippingProvider: new TieredShippingProvider() // Tiered shipping calculation
  }
});

const aiEngine = new AIShoppingEngine(aiConfig, baseUrl);

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    console.log('Processing AI chat for user:', session.user.email);
    console.log('Messages:', messages.length);

    // Process chat using AI engine
    const response = await aiEngine.processChat(messages, session.user.email);

    return NextResponse.json({
      message: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET method for testing
export async function GET() {
  return NextResponse.json({ 
    message: 'AI Chat API is running',
    endpoints: {
      POST: 'Send chat messages with AI processing'
    }
  });
}