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
  type ProfileProvider,
  type CartItem
} from '../../../../lib/ai-shopping-assistant';
import { 
  getProductsFromSupabase, 
  getCartFromSupabase, 
  saveCartToSupabase, 
  deleteCartFromSupabase,
  getUserProfileFromSupabase 
} from '@/lib/supabase-storage';

const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// Direct service providers that use database calls instead of HTTP (more secure)
// Note: Using userIdentifier as parameter name for flexibility - can be email, user ID, etc.
class DirectServiceProductProvider implements ProductProvider {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async search(query: string, options?: { category?: string; limit?: number }) {
    // TODO: Implement search filtering based on query and options
    const allProducts = await getProductsFromSupabase();
    
    // Map to the expected Product interface
    return allProducts.map(product => ({
      id: product.id,
      name: product.productName,
      description: '',
      price: product.pricing?.price || 0,
      category: product.category || '',
      imageUrl: product.imageUrl || '',
      specifications: {}
    }));
  }
}

class DirectServiceCartProvider implements CartProvider {
  async getCart(userIdentifier: string) {
    console.log("Fetching cart for user:", userIdentifier);
    const cartItems = await getCartFromSupabase(userIdentifier);
    
    const mappedCartItems: CartItem[] = cartItems.map(item => ({
      id: item.id,
      name: item.productName,
      price: item.price,
      quantity: item.quantity,
      imageUrl: item.imageUrl,
      addedAt: item.addedAt
    }));
    
    return {
      items: mappedCartItems,
      totalItems: mappedCartItems.reduce((sum: number, item: CartItem) => sum + item.quantity, 0),
      totalAmount: mappedCartItems.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0),
      sessionId: userIdentifier
    };
  }

  async addItems(userIdentifier: string, items: Array<{ productId: string; quantity: number }>) {
    const allProducts = await getProductsFromSupabase();
    
    const cartItems = [];
    for (const item of items) {
      const product = allProducts.find(p => p.id === item.productId);
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
    await saveCartToSupabase(userIdentifier, cartItems);
    return await this.getCart(userIdentifier);
  }

  async removeItems(userIdentifier: string, items: Array<{ productId: string; quantity?: number; removeAll?: boolean }>) {
    // Map to the format expected by deleteCartFromSupabase
    const cartItemsToRemove = items.map(item => ({
      productId: item.productId,
      quantity: item.quantity || 0
    }));
    
    await deleteCartFromSupabase(userIdentifier, cartItemsToRemove);
    return await this.getCart(userIdentifier);
  }

  async clearCart(userIdentifier: string) {
    await deleteCartFromSupabase(userIdentifier);
    return await this.getCart(userIdentifier);
  }
}

class DirectServiceProfileProvider implements ProfileProvider {
  async getShippingAddress(userIdentifier: string) {
    const profile = await getUserProfileFromSupabase(userIdentifier);
    
    if (!profile?.shippingAddress) return null;
    
    return {
      firstName: profile.shippingAddress.firstName || '',
      lastName: profile.shippingAddress.lastName || '',
      address1: profile.shippingAddress.address1 || '',
      address2: profile.shippingAddress.address2 || '',
      city: profile.shippingAddress.city || '',
      state: profile.shippingAddress.state || '',
      zipCode: profile.shippingAddress.postalCode || '',
      country: profile.shippingAddress.country || '',
      phone: profile.shippingAddress.phone || ''
    };
  }
}

// Create AI engine with server-side secrets
const aiConfig = createAIShoppingConfig({
  azureOpenAI: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4'
  },
  productProvider: new DirectServiceProductProvider(),
  cartProvider: new DirectServiceCartProvider(),
  profileProvider: new DirectServiceProfileProvider(),
  paymentProvider: new StripePaymentProvider(process.env.STRIPE_SECRET_KEY!),
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

    // Use email as user identifier for this implementation
    const userIdentifier = session.user.email;
    
    console.log('Processing AI chat for user:', userIdentifier);
    console.log('Messages:', messages.length);

    // Process chat using AI engine
    const response = await aiEngine.processChat(messages, userIdentifier);

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