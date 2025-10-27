import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// Types for chat functionality
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  actions?: ChatAction[];
}

interface ChatAction {
  type: 'add_to_cart' | 'view_cart' | 'checkout' | 'view_product' | 'search_products' | 'compare_products';
  data?: Record<string, unknown>;
  label: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  specifications?: Record<string, string | number | boolean>;
}

interface UserContext {
  userId?: string;
  timestamp: string;
}

// Azure OpenAI Configuration
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4';



// System prompt for the AI assistant
const SYSTEM_PROMPT = `
You are a helpful shopping assistant for an e-commerce platform.

Format your responses in a conversational way, and provide specific product recommendations based on the search results. When displaying search results, always format product names as clickable links to their product pages using the format [Product Name](/products/product-id). Use markdown tables to display product information in a structured format when showing multiple products. For example:

| Product | Category | Price | Description |
|---------|----------|-------|-------------|
| [iPhone 15](/products/abc123) | Electronics | $999 | Latest smartphone... |
| [Samsung TV](/products/def456) | Electronics | $899 | 4K Smart TV... |

Always make product names clickable links to their respective product pages using the format: [Product Name](/products/product-id)`;

// Define available tools for the AI
const tools = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search for products in the catalog by name, category, description, or specifications",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find products"
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default: 10)"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_to_cart",
      description: "Add a single product to the user's shopping cart with specified quantity. Be sure to use this multiple times to add different products.",
      parameters: {
        type: "object",
        properties: {
          productId: {
            type: "string",
            description: "The ID of the product to add to cart"
          },
          quantity: {
            type: "number",
            description: "The quantity of the product to add (default: 1)"
          }
        },
        required: ["productId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "view_cart",
      description: "View the current contents of the user's shopping cart",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  }
];

// Function to execute tool calls
async function executeTool(toolName: string, parameters: Record<string, unknown>, userEmail?: string): Promise<string> {
  switch (toolName) {
    case 'search_products': {
      const query = parameters.query as string;
      const category = parameters.category as string | undefined;
      const limit = (parameters.limit as number) || 10;
      
      try {
        // Use the existing search API
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const searchParams = new URLSearchParams({
          q: query,
          limit: limit.toString()
        });
        
        if (category) {
          searchParams.append('category', category);
        }
        
        const response = await fetch(`${baseUrl}/api/search?${searchParams}`);
        
        if (!response.ok) {
          return JSON.stringify({ error: 'Search failed' });
        }
        
        const searchResults = await response.json();
        // console.log(searchResults)
        return JSON.stringify(searchResults);
      } catch {
        return JSON.stringify({ error: 'Failed to search products' });
      }
    }

    case 'add_to_cart': {
      const productId = parameters.productId as string;
      const quantity = (parameters.quantity as number) || 1;
      
      console.log('add_to_cart called with:', { productId, quantity, userEmail });
      
      try {
        // First, get product details using the products API
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const productsResponse = await fetch(`${baseUrl}/api/products`);
        
        if (!productsResponse.ok) {
          console.error('Failed to fetch products:', productsResponse.status);
          return JSON.stringify({ error: 'Failed to fetch products' });
        }
        
        const products = await productsResponse.json();
        const product = products.find((p: { id: string }) => p.id === productId);
        
        if (!product) {
          console.error('Product not found:', productId);
          return JSON.stringify({ error: 'Product not found' });
        }
        
        console.log('Found product:', product.productName);
        
        // Use user's email as session ID
        const sessionId = userEmail || 'anonymous-user';
        console.log('Using session ID:', sessionId);
        
        // Get current cart items
        const cartResponse = await fetch(`${baseUrl}/api/cart?sessionId=${sessionId}`);
        const cartData = cartResponse.ok ? await cartResponse.json() : { items: [] };
        const currentItems = cartData.items || [];
        
        console.log('Current cart items:', currentItems.length);
        
        // Check if item already exists in cart
        const existingItemIndex = currentItems.findIndex((item: { id: string }) => item.id === productId);
        
        let updatedItems;
        if (existingItemIndex >= 0) {
          // Update quantity of existing item
          updatedItems = [...currentItems];
          updatedItems[existingItemIndex].quantity += quantity;
          console.log('Updated existing item quantity');
        } else {
          // Add new item to cart
          const cartItem = {
            id: productId,
            productName: product.productName || product.name || 'Unknown Product',
            slug: product.slug || '',
            imageUrl: product.imageUrl || '',
            price: Number(product.pricing?.price || product.price || 0),
            currency: 'USD',
            quantity: Number(quantity),
            category: product.category || 'General'
          };
          updatedItems = [...currentItems, cartItem];
          console.log('Added new item to cart:', cartItem.productName);
        }
        
        // Save updated cart
        console.log('Saving cart with', updatedItems.length, 'items');
        const saveResponse = await fetch(`${baseUrl}/api/cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId,
            items: updatedItems
          })
        });
        
        if (!saveResponse.ok) {
          const errorData = await saveResponse.text();
          console.error('Cart save error:', saveResponse.status, errorData);
          return JSON.stringify({ error: `Failed to add item to cart: ${errorData}` });
        }
        
        const saveResult = await saveResponse.json();
        console.log('Cart save successful:', saveResult);
        
        return JSON.stringify({
          success: true,
          message: `Added ${quantity} x ${product.productName || product.name} to your cart (session: ${sessionId}). Total items: ${saveResult.totalItems}`,
          totalItems: saveResult.totalItems,
          cartUrl: '/cart',
          sessionId: sessionId  // Include session ID for debugging
        });
        
      } catch (error) {
        console.error('Error adding to cart:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({ error: `Failed to add item to cart: ${errorMessage}` });
      }
    }

    case 'view_cart': {
      try {
        // Use user's email as session ID
        const sessionId = userEmail || 'anonymous-user';
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        
        const cartResponse = await fetch(`${baseUrl}/api/cart?sessionId=${sessionId}`);
        
        if (!cartResponse.ok) {
          return JSON.stringify({ error: 'Failed to fetch cart' });
        }
        
        const cartData = await cartResponse.json();
        return JSON.stringify({
          success: true,
          items: cartData.items || [],
          totalItems: cartData.totalItems || 0,
          totalAmount: cartData.totalAmount || 0
        });
        
      } catch (error) {
        console.error('Error viewing cart:', error);
        return JSON.stringify({ error: 'Failed to fetch cart contents' });
      }
    }
    
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// Function to call Azure OpenAI with tools
async function callAzureOpenAI(messages: ChatMessage[], userContext?: UserContext, userEmail?: string) {
  if (!AZURE_OPENAI_ENDPOINT || !AZURE_OPENAI_API_KEY) {
    throw new Error('Azure OpenAI configuration missing');
  }

  // Add system message with context
  const systemMessage: ChatMessage = {
    role: 'system',
    content: `${SYSTEM_PROMPT}\n\n${userContext ? `\n\nUser context: ${JSON.stringify(userContext)}` : ''}`
  };

  const chatMessages = [systemMessage, ...messages];

  try {
    const response = await fetch(`${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=2024-12-01-preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify({
        messages: chatMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        tools: tools,
        tool_choice: "auto",
        max_tokens: 2000,
        temperature: 0.7,
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure OpenAI error:', response.status, errorText);
      throw new Error(`Azure OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const assistantMessage = result.choices[0]?.message;

    // Check if the assistant wants to call tools
    if (assistantMessage?.tool_calls) {
      // Add the assistant message with tool calls to conversation
      const toolMessages = [systemMessage, ...messages, assistantMessage];

      console.log("executing tool calls:", assistantMessage.tool_calls);
      
      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolResult = await executeTool(
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments),
          userEmail
        );
        
        // Add tool result to conversation
        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult
        });
      }
      
      // Make another call to get the final response
      const finalResponse = await fetch(`${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=2024-12-01-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_API_KEY,
        },
        body: JSON.stringify({
          messages: toolMessages,
          max_tokens: 2000,
          temperature: 0.7,
          top_p: 0.9,
        }),
      });

      if (finalResponse.ok) {
        const finalResult = await finalResponse.json();
        return finalResult.choices[0]?.message?.content || 'I apologize, but I cannot process your request right now.';
      }
    }

    return assistantMessage?.content || 'I apologize, but I cannot process your request right now.';
  } catch (error) {
    console.error('Error calling Azure OpenAI:', error);
    throw new Error('Failed to get AI response');
  }
}

// Function to detect if user wants to perform actions
function detectActions(userMessage: string): ChatAction[] {
  const message = userMessage.toLowerCase();
  const actions: ChatAction[] = [];

  // Search actions
  if (message.includes('search') || message.includes('find') || message.includes('look for')) {
    actions.push({
      type: 'search_products',
      label: 'Search Products',
      data: { query: userMessage }
    });
  }

  // Cart actions
  if (message.includes('cart') || message.includes('basket')) {
    actions.push({
      type: 'view_cart',
      label: 'View Cart'
    });
  }

  // Checkout actions
  if (message.includes('buy') || message.includes('purchase') || message.includes('checkout') || message.includes('order')) {
    actions.push({
      type: 'checkout',
      label: 'Proceed to Checkout'
    });
  }

  return actions;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, action } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    // Handle specific actions
    if (action) {
      switch (action.type) {
        case 'search_products': {
          const query = action.data?.query as string || '';
          const toolResult = await executeTool('search_products', { query }, session.user?.email || undefined);
          const searchData = JSON.parse(toolResult);
          
          if (searchData.results && searchData.results.length > 0) {
            // Create markdown table with clickable product links
            const tableHeader = '| Product | Category | Price | Description |\n|---------|----------|-------|-------------|';
            const tableRows = searchData.results.map((p: Product) => 
              `| [**${p.name}**](/products/${p.id}) | ${p.category} | $${p.price} | ${(p.description || '').substring(0, 80)}... |`
            ).join('\n');
            
            const response = `I found ${searchData.results.length} products matching your search:\n\n${tableHeader}\n${tableRows}`;
            
            return NextResponse.json({
              message: response,
              products: searchData.results,
              actions: searchData.results.map((p: Product) => ({
                type: 'view_product',
                label: `View ${p.name}`,
                data: { productId: p.id }
              }))
            });
          } else {
            return NextResponse.json({
              message: "I couldn't find any products matching your search. Please try a different search term.",
              actions: [
                { type: 'search_products', label: 'Try Another Search', data: {} }
              ]
            });
          }
          break;
        }
        
        case 'view_cart': {
          // This would integrate with your cart system
          return NextResponse.json({
            message: "Here's your current cart. (Cart integration would go here)",
            actions: [
              { type: 'checkout', label: 'Proceed to Checkout' }
            ]
          });
        }
        
        default:
          break;
      }
    }

    // Get user context (you might want to fetch cart, preferences, etc.)
    const userContext: UserContext = {
      userId: session.user?.email || undefined,
      timestamp: new Date().toISOString()
    };

    // Call Azure OpenAI
    const aiResponse = await callAzureOpenAI(messages, userContext, session.user?.email || undefined);

    // Detect possible actions from user message
    const lastUserMessage = messages[messages.length - 1];
    const suggestedActions = detectActions(lastUserMessage?.content || '');

    const response = NextResponse.json({
      message: aiResponse,
      actions: suggestedActions,
      timestamp: new Date().toISOString()
    });

    // Disable all caching for chat responses
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET method for testing
export async function GET() {
  return NextResponse.json({ 
    message: 'Chat API is running',
    endpoints: {
      POST: 'Send chat messages',
      configuration: {
        azure_endpoint: !!AZURE_OPENAI_ENDPOINT,
        api_key_configured: !!AZURE_OPENAI_API_KEY,
        deployment: AZURE_OPENAI_DEPLOYMENT_NAME
      }
    }
  });
}