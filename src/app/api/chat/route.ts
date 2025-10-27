import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { calculateOrderTotals } from '@/lib/order-calculations';
import Stripe from 'stripe';

// System prompt for the AI assistant
const SYSTEM_PROMPT = `
You are a helpful shopping assistant for an e-commerce platform with autonomous checkout capabilities.

**Core Functions:**
- Search and recommend products based on user needs
- Add products to user's cart (single items or multiple items at once)
- Complete purchases on user's behalf when requested

**Product Recommendations:**
Format your responses conversationally and provide specific product recommendations. When displaying search results, always format product names as clickable links using [Product Name](/products/product-id). Use markdown tables for multiple products:

| Product | Category | Price | Description |
|---------|----------|-------|-------------|
| [iPhone 15](/products/abc123) | Electronics | $999 | Latest smartphone... |
| [Samsung TV](/products/def456) | Electronics | $899 | 4K Smart TV... |

**Payment Methods & Profile:**
- The system automatically uses the user's saved shipping address and payment methods from their profile
- If no saved information is found, guide users to complete their profile at /profile
- Users must have both shipping address and payment methods saved in their profile for autonomous checkout
- Multiple payment methods are supported with default selection

**Example Flow:**
User: "Proceed with my order"
Assistant: [Use preview_order] "Here's your order summary: [details]. I'll ship to [address] and charge your saved payment method. Would you like me to proceed with this order?"
User: "Yes, place the order"
Assistant: [Use complete_checkout] "🎉 Order placed successfully! Your order #ORD-123 is confirmed."

If profile is incomplete: "Please complete your shipping address and add a payment method in your profile settings first, then I can process your order automatically."

**Cart Management:**
- Use add_to_cart for adding single or multiple products - pass an array of items with productId and optional quantity
- Use remove_from_cart to remove items from cart (supports removing specific quantities or entire items)
- Use view_cart to show current cart contents
- When users mention multiple products they want, use the bulk add function
- When users want to remove items, use remove_from_cart with appropriate quantities

**Important Guidelines:**
- Be proactive in suggesting purchases when users show interest
- ALWAYS use preview_order first when user wants to checkout - never go directly to complete_checkout
- Present clear order summary with items, prices, shipping, and total
- Ask for explicit confirmation: "Would you like me to proceed with this order?"
- Only use complete_checkout AFTER user explicitly confirms (says "yes", "proceed", "place order", etc.)
- Handle payment processing automatically and securely using saved payment methods
- If payment fails, guide users to add/update payment methods
- Provide clear order confirmations and tracking information
- Be helpful throughout the entire shopping and purchase journey`;

// Types for chat functionality
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  actions?: ChatAction[];
}

interface ChatAction {
  type: 'add_to_cart' | 'view_cart' | 'remove_from_cart' | 'preview_order' | 'checkout' | 'view_product' | 'search_products' | 'compare_products';
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
      description: "Add one or more products to the user's shopping cart. Can add a single product or multiple products at once.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "Array of products to add to cart. For single item, use array with one item.",
            items: {
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
        required: ["items"]
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
  },
  {
    type: "function",
    function: {
      name: "remove_from_cart",
      description: "Remove one or more items from the user's shopping cart. Can remove specific quantities or entire items.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "Array of items to remove from cart",
            items: {
              type: "object",
              properties: {
                productId: {
                  type: "string",
                  description: "The ID of the product to remove from cart"
                },
                quantity: {
                  type: "number",
                  description: "The quantity to remove. If not specified or if quantity >= current quantity, removes the entire item from cart"
                },
                removeAll: {
                  type: "boolean",
                  description: "If true, removes all quantities of this item from cart"
                }
              },
              required: ["productId"]
            }
          }
        },
        required: ["items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "preview_order",
      description: "Get order preview with cart contents, shipping address, payment method, and total before checkout. Use this to show order summary and ask for confirmation.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "complete_checkout",
      description: "Complete the purchase of items in the user's cart using their saved profile information. ONLY use this AFTER the user has explicitly confirmed they want to proceed with the order.",
      parameters: {
        type: "object",
        properties: {
          orderNote: {
            type: "string",
            description: "Optional note for the order"
          }
        },
        required: ["orderNote"]
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
      const items = parameters.items as Array<{ productId: string; quantity?: number }>;
      
      console.log('add_to_cart called with:', { items: items.length, userEmail });
      
      try {
        // First, get product details using the products API
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const productsResponse = await fetch(`${baseUrl}/api/products`);
        
        if (!productsResponse.ok) {
          console.error('Failed to fetch products:', productsResponse.status);
          return JSON.stringify({ error: 'Failed to fetch products' });
        }
        
        const products = await productsResponse.json();
        
        // Validate all products exist
        const processedItems = [];
        for (const item of items) {
          const product = products.find((p: { id: string }) => p.id === item.productId);
          if (!product) {
            console.error('Product not found:', item.productId);
            return JSON.stringify({ error: `Product not found: ${item.productId}` });
          }
          processedItems.push({
            product,
            quantity: item.quantity || 1
          });
        }
        
        console.log('All products validated, processing cart update');
        
        // Use user's email as session ID
        const sessionId = userEmail || 'anonymous-user';
        console.log('Using session ID:', sessionId);
        
        // Get current cart items
        const cartResponse = await fetch(`${baseUrl}/api/cart?sessionId=${sessionId}`);
        const cartData = cartResponse.ok ? await cartResponse.json() : { items: [] };
        const updatedItems = [...(cartData.items || [])];
        
        console.log('Current cart items:', updatedItems.length);
        
        // Process each item
        const addedProducts = [];
        for (const { product, quantity } of processedItems) {
          const existingItemIndex = updatedItems.findIndex((item: { id: string }) => item.id === product.id);
          
          if (existingItemIndex >= 0) {
            // Update quantity of existing item
            updatedItems[existingItemIndex].quantity += quantity;
            console.log(`Updated existing item: ${product.productName} (+${quantity})`);
          } else {
            // Add new item to cart
            const cartItem = {
              id: product.id,
              productName: product.productName || product.name || 'Unknown Product',
              slug: product.slug || '',
              imageUrl: product.imageUrl || '',
              price: Number(product.pricing?.price || product.price || 0),
              currency: 'USD',
              quantity: Number(quantity),
              category: product.category || 'General'
            };
            updatedItems.push(cartItem);
            console.log('Added new item to cart:', cartItem.productName);
          }
          
          addedProducts.push({
            name: product.productName || product.name,
            quantity: quantity
          });
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
          return JSON.stringify({ error: `Failed to add items to cart: ${errorData}` });
        }
        
        const saveResult = await saveResponse.json();
        console.log('Cart save successful:', saveResult);
        
        // Create appropriate response message
        let message: string;
        if (items.length === 1) {
          // Single item message
          const item = addedProducts[0];
          message = `Added ${item.quantity} x ${item.name} to your cart (session: ${sessionId}). Total items: ${saveResult.totalItems}`;
        } else {
          // Multiple items message
          const itemsText = addedProducts.map(item => `${item.quantity} x ${item.name}`).join(', ');
          message = `Added ${addedProducts.length} products to your cart: ${itemsText} (session: ${sessionId}). Total items: ${saveResult.totalItems}`;
        }
        
        return JSON.stringify({
          success: true,
          message: message,
          totalItems: saveResult.totalItems,
          cartUrl: '/cart',
          sessionId: sessionId,
          addedProducts: addedProducts
        });
        
      } catch (error) {
        console.error('Error adding to cart:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({ error: `Failed to add items to cart: ${errorMessage}` });
      }
    }

    case 'remove_from_cart': {
      const items = parameters.items as Array<{ productId: string; quantity?: number; removeAll?: boolean }>;
      
      console.log('remove_from_cart called with:', { items: items.length, userEmail });
      
      try {
        // Use user's email as session ID
        const sessionId = userEmail || 'anonymous-user';
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        
        // Get current cart items
        const cartResponse = await fetch(`${baseUrl}/api/cart?sessionId=${sessionId}`);
        const cartData = cartResponse.ok ? await cartResponse.json() : { items: [] };
        // eslint-disable-next-line prefer-const
        let updatedItems = [...(cartData.items || [])];
        
        console.log('Current cart items before removal:', updatedItems.length);
        
        // Process each item removal
        const removedProducts = [];
        for (const removeItem of items) {
          const existingItemIndex = updatedItems.findIndex((item: { id: string }) => item.id === removeItem.productId);
          
          if (existingItemIndex >= 0) {
            const currentItem = updatedItems[existingItemIndex];
            const currentQuantity = currentItem.quantity;
            
            if (removeItem.removeAll || !removeItem.quantity || removeItem.quantity >= currentQuantity) {
              // Remove entire item
              updatedItems.splice(existingItemIndex, 1);
              removedProducts.push({
                name: currentItem.productName,
                quantity: currentQuantity,
                action: 'removed completely'
              });
              console.log(`Completely removed item: ${currentItem.productName} (${currentQuantity} units)`);
            } else {
              // Reduce quantity
              updatedItems[existingItemIndex].quantity -= removeItem.quantity;
              removedProducts.push({
                name: currentItem.productName,
                quantity: removeItem.quantity,
                action: 'reduced quantity'
              });
              console.log(`Reduced quantity: ${currentItem.productName} (-${removeItem.quantity}, now ${updatedItems[existingItemIndex].quantity})`);
            }
          } else {
            console.log(`Item not found in cart: ${removeItem.productId}`);
            removedProducts.push({
              name: removeItem.productId,
              quantity: 0,
              action: 'not found'
            });
          }
        }
        
        // Save updated cart
        console.log('Saving cart with', updatedItems.length, 'items after removal');
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
          return JSON.stringify({ error: `Failed to update cart: ${errorData}` });
        }
        
        const saveResult = await saveResponse.json();
        console.log('Cart update successful:', saveResult);
        
        // Create a summary message
        const validRemovals = removedProducts.filter(item => item.action !== 'not found');
        const notFoundItems = removedProducts.filter(item => item.action === 'not found');
        
        let message = '';
        if (validRemovals.length > 0) {
          const itemsText = validRemovals.map(item => 
            item.action === 'removed completely' 
              ? `${item.name} (removed completely)` 
              : `${item.quantity} x ${item.name} (reduced)`
          ).join(', ');
          message = `Updated cart: ${itemsText}`;
        }
        
        if (notFoundItems.length > 0) {
          const notFoundText = notFoundItems.map(item => item.name).join(', ');
          message += (message ? '. ' : '') + `Items not found in cart: ${notFoundText}`;
        }
        
        return JSON.stringify({
          success: true,
          message: message || 'No changes made to cart',
          totalItems: saveResult.totalItems,
          cartUrl: '/cart',
          sessionId: sessionId,
          removedProducts: removedProducts
        });
        
      } catch (error) {
        console.error('Error removing items from cart:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({ error: `Failed to remove items from cart: ${errorMessage}` });
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

    case 'preview_order': {
      try {
        if (!userEmail) {
          return JSON.stringify({ error: 'User must be logged in to preview order' });
        }

        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const sessionId = userEmail;

        // Get cart contents
        const cartResponse = await fetch(`${baseUrl}/api/cart?sessionId=${sessionId}`);
        if (!cartResponse.ok) {
          return JSON.stringify({ error: 'Failed to fetch cart' });
        }
        
        const cartData = await cartResponse.json();
        const cartItems = cartData.items || [];
        
        if (cartItems.length === 0) {
          return JSON.stringify({ error: 'Cart is empty. Please add items before checkout.' });
        }

        // Get user profile for shipping and payment info
        const profileResponse = await fetch(`${baseUrl}/api/profile?userEmail=${encodeURIComponent(userEmail)}`);
        let shippingAddress = null;
        let hasPaymentMethod = false;
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          shippingAddress = profileData.profile?.shippingAddress;
          
          // Check if user has payment methods in Stripe
          try {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
              apiVersion: '2025-09-30.clover',
            });
            const customers = await stripe.customers.list({
              email: userEmail,
              limit: 1,
            });
            
            if (customers.data.length > 0) {
              const paymentMethods = await stripe.paymentMethods.list({
                customer: customers.data[0].id,
                type: 'card',
              });
              hasPaymentMethod = paymentMethods.data.length > 0;
            }
          } catch (stripeError) {
            console.log('Could not check payment methods:', stripeError);
          }
        }

        // Calculate order totals using the utility function
        const orderSummary = calculateOrderTotals(cartItems);

        return JSON.stringify({
          success: true,
          cartItems: cartItems,
          totalItems: cartData.totalItems || 0,
          orderSummary: orderSummary,
          shippingAddress: shippingAddress,
          hasPaymentMethod: hasPaymentMethod,
          readyForCheckout: !!(shippingAddress?.firstName && shippingAddress?.address1 && hasPaymentMethod)
        });

      } catch (error) {
        console.error('Error previewing order:', error);
        return JSON.stringify({ error: 'Failed to preview order' });
      }
    }

    case 'complete_checkout': {
      try {
        const orderNote = parameters.orderNote as string | undefined;
        
        if (!userEmail) {
          return JSON.stringify({ error: 'User must be logged in to complete checkout' });
        }

        console.log('Agent completing checkout for user:', userEmail);

        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const sessionId = userEmail;

        // Step 1: Get current cart
        const cartResponse = await fetch(`${baseUrl}/api/cart?sessionId=${sessionId}`);
        if (!cartResponse.ok) {
          return JSON.stringify({ error: 'Failed to fetch cart' });
        }
        
        const cartData = await cartResponse.json();
        const cartItems = cartData.items || [];
        
        if (cartItems.length === 0) {
          return JSON.stringify({ error: 'Cart is empty. Please add items before checkout.' });
        }

        // Step 2: Get stored shipping info from user's profile
        console.log('Fetching user profile for shipping information...');
        
        let shippingInfo;
        try {
          // Pass userEmail as query parameter for server-side profile retrieval
          const profileResponse = await fetch(`${baseUrl}/api/profile?userEmail=${encodeURIComponent(userEmail)}`);
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            console.log('Profile data retrieved in chat:', JSON.stringify(profileData, null, 2));
            const storedAddress = profileData.profile?.shippingAddress;
            
            console.log('Shipping address from profile:', JSON.stringify(storedAddress, null, 2));
            
            if (storedAddress && storedAddress.firstName && storedAddress.address1) {
              shippingInfo = {
                firstName: storedAddress.firstName,
                lastName: storedAddress.lastName,
                address: storedAddress.address1,
                city: storedAddress.city,
                state: storedAddress.state,
                zipCode: storedAddress.postalCode,
                phone: storedAddress.phone || ''
              };
              console.log('Using stored shipping address for checkout:', JSON.stringify(shippingInfo, null, 2));
            } else {
              console.log('Shipping address validation failed:', {
                hasAddress: !!storedAddress,
                hasFirstName: !!(storedAddress?.firstName),
                hasAddress1: !!(storedAddress?.address1),
                actualFields: storedAddress ? Object.keys(storedAddress) : []
              });
            }
          } else {
            console.log('Profile API response not OK:', profileResponse.status);
          }
        } catch (profileError) {
          console.log('Could not fetch stored profile:', profileError);
        }
        
        if (!shippingInfo) {
          return JSON.stringify({ 
            error: 'No shipping address found in your profile. Please save your shipping address in your profile settings first, then try again.',
            requiresProfile: true
          });
        }

        // Step 3: Try direct checkout with saved payment methods first
        console.log('Attempting direct checkout with saved payment methods...');
        
        const directCheckoutResponse = await fetch(`${baseUrl}/api/direct-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cartItems,
            shippingInfo,
            useDefaultPaymentMethod: true,
            orderNote: orderNote || 'Order placed via AI assistant',
            userEmail: userEmail // Pass user email for server-side authentication
          })
        });

        if (directCheckoutResponse.ok) {
          // Direct checkout succeeded
          const checkoutData = await directCheckoutResponse.json();
          
          // Clear the cart after successful order
          await fetch(`${baseUrl}/api/cart`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
          });

          return JSON.stringify({
            success: true,
            message: `🎉 Order placed successfully using your saved payment method! Your order ${checkoutData.orderId} is confirmed.`,
            orderId: checkoutData.orderId,
            total: checkoutData.orderData.total,
            currency: checkoutData.orderData.currency,
            itemCount: checkoutData.orderData.items
          });
        }

        console.log('Direct checkout failed, falling back to SPT method...');
        
        // Step 4: Fallback to Shared Payment Token method
        // For demo purposes, we'll use a default payment method
        // In production, this would use the user's stored payment method
        const sptResponse = await fetch(`${baseUrl}/api/shared-payment-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cartItems,
            paymentMethodId: 'pm_card_visa', // Demo payment method
            userEmail: userEmail // Pass user email for server-side authentication
          })
        });

        if (!sptResponse.ok) {
          const sptError = await sptResponse.json();
          return JSON.stringify({ 
            error: 'Payment setup failed. Please add a payment method in your profile settings first.', 
            details: sptError.error || 'No payment methods available'
          });
        }

        const sptData = await sptResponse.json();

        // Step 5: Complete agent checkout with SPT
        const checkoutResponse = await fetch(`${baseUrl}/api/agent-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shared_payment_token: sptData.shared_payment_token,
            cartItems,
            shippingInfo,
            orderNote: 'Order placed via AI assistant (SPT fallback)'
          })
        });

        if (!checkoutResponse.ok) {
          const checkoutError = await checkoutResponse.json();
          return JSON.stringify({ 
            error: 'Checkout failed. Please add a payment method in your profile settings.', 
            details: checkoutError.error || 'Payment processing error'
          });
        }

        const checkoutData = await checkoutResponse.json();

        // Step 6: Clear the cart after successful order
        await fetch(`${baseUrl}/api/cart`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });

        return JSON.stringify({
          success: true,
          message: `🎉 Order placed successfully! Your order ${checkoutData.orderId} is confirmed.`,
          orderId: checkoutData.orderId,
          total: checkoutData.orderData.total,
          currency: checkoutData.orderData.currency,
          itemCount: checkoutData.orderData.items
        });

      } catch (error) {
        console.error('Error in agent checkout:', error);
        return JSON.stringify({ 
          error: 'Checkout process failed', 
          details: error instanceof Error ? error.message : 'Unknown error'
        });
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