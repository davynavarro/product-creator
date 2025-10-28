import { ChatMessage, AIShoppingConfig, ToolResult, TaxCalculationContext, ShippingCalculationContext, CartItem, ShippingAddress } from './types';

// Default order calculations (fallback when no custom providers are configured)
interface OrderTotals {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
}

// Default tax calculation (8% - configurable per app)
function defaultTaxCalculation(context: TaxCalculationContext): number {
  return context.subtotal * 0.08;
}

// Default shipping calculation (free over $50, otherwise $9.99 - configurable per app)
function defaultShippingCalculation(context: ShippingCalculationContext): number {
  return context.subtotal > 50 ? 0 : 9.99;
}

async function calculateOrderTotals(
  items: CartItem[], 
  config: AIShoppingConfig,
  shippingAddress?: ShippingAddress
): Promise<OrderTotals> {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const currency = config.orderCalculations?.currency || 'USD';
  
  const taxContext: TaxCalculationContext = { subtotal, shippingAddress, items };
  const shippingContext: ShippingCalculationContext = { subtotal, shippingAddress, items };
  
  // Use custom providers if available, otherwise use defaults
  const tax = config.orderCalculations?.taxProvider 
    ? await config.orderCalculations.taxProvider.calculateTax(taxContext)
    : defaultTaxCalculation(taxContext);
    
  const shipping = config.orderCalculations?.shippingProvider
    ? await config.orderCalculations.shippingProvider.calculateShipping(shippingContext)
    : defaultShippingCalculation(shippingContext);
  
  const total = subtotal + shipping + tax;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    shipping: Number(shipping.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    total: Number(total.toFixed(2)),
    currency
  };
}

export class AIShoppingEngine {
  private config: AIShoppingConfig;
  private baseUrl: string;

  constructor(config: AIShoppingConfig, baseUrl?: string) {
    this.config = config;
    this.baseUrl = baseUrl || '';
  }

  // System prompt for the AI assistant
  private getSystemPrompt(): string {
    return `
You are a helpful shopping assistant for an e-commerce platform with autonomous checkout capabilities.

**Core Functions:**
- Search and recommend products based on user needs
- Add products to user's cart (single items or multiple items at once)
- Complete purchases on user's behalf when requested

**Searching and Managing the Cart:**
- Understand the user's intent and add items to cart after doing search, if they ask you to do so.

**Product Recommendations:**
Format your responses conversationally and provide specific product recommendations. When displaying search results, always format product names as clickable links using [Product Name](/products/product-id). Use markdown tables for multiple products:
Only show products from the search results you retrieve, do not make up products.
Always show products/cart/preview in table format like this:

| Product | Price | Description |  # In Cart |
|---------|-------|-------------|-------------|
| [Product 1](/products/prd1) | $999 | Product 1 details... | <number of items in cart> |
| [Product 2](/products/prd2) | $899 | Product 2 details... | <number of items in cart> |

**Checkout Process:**
- When the user initiates a checkout process, use "preview_order" to show a summary of the order and confirming with the user.
- After the user confirmation, use "complete_checkout" to process the payment and complete the order.
- Always include the following details after the checkout process:
  - Order ID: <order id>
  - Items: <number of items>
  - Total charged: <total cost>

**Payment Methods & Profile:**
- The system automatically uses the user's saved shipping address and payment methods from their profile
- If no saved information is found, Ask the user to complete his/her profile, payment, and shipping details by going to the [Profile](/profile) page before proceeding with checkout. Giving the [Profile](/profile) link is important.
- Users must have both shipping address and payment methods saved in their profile for autonomous checkout

`;
  }

  // Define available tools for the AI
  private getTools() {
    return [
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
                },
                description: "Array of products to add to cart"
              }
            },
            required: ["items"]
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
                },
                description: "Array of products to remove from cart"
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
          description: "View current contents of the user's shopping cart",
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
          name: "preview_order",
          description: "Use this when the user initiates a checkout process. This is an important step for the user to see the shipping and tax cost. Get order preview with cart contents, shipping address, payment method, and total before complete checkout. Use this to show order summary and ask for confirmation to proceed with payment.",
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
            required: []
          }
        }
      }
    ];
  }

  // Execute tool calls using configured providers
  async executeTool(toolName: string, parameters: Record<string, unknown>, userEmail: string): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'search_products':
          return await this.handleSearchProducts(parameters);
          
        case 'add_to_cart':
          return await this.handleAddToCart(parameters, userEmail);
          
        case 'remove_from_cart':
          return await this.handleRemoveFromCart(parameters, userEmail);
          
        case 'view_cart':
          return await this.handleViewCart(userEmail);
          
        case 'preview_order':
          return await this.handlePreviewOrder(userEmail);
          
        case 'complete_checkout':
          return await this.handleCompleteCheckout(parameters, userEmail);
          
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async handleSearchProducts(parameters: Record<string, unknown>): Promise<ToolResult> {
    const query = parameters.query as string;
    const limit = (parameters.limit as number) || 10;
    
    const results = await this.config.productProvider.search(query, { limit });
    
    return {
      success: true,
      data: {
        results,
        total: results.length,
        query
      },
      message: `Found ${results.length} products matching "${query}"`
    };
  }

  private async handleAddToCart(parameters: Record<string, unknown>, userEmail: string): Promise<ToolResult> {
    const items = parameters.items as Array<{ productId: string; quantity?: number }>;
    
    // Prepare cart items (no need to validate since AI only gets productIds from search results)
    const validatedItems = items.map(item => ({
      productId: item.productId,
      quantity: item.quantity || 1
    }));
    
    const cart = await this.config.cartProvider.addItems(userEmail, validatedItems);
    
    return {
      success: true,
      data: cart,
      message: `Added ${validatedItems.length} item(s) to cart`
    };
  }

  private async handleRemoveFromCart(parameters: Record<string, unknown>, userEmail: string): Promise<ToolResult> {
    const items = parameters.items as Array<{ productId: string; quantity?: number; removeAll?: boolean }>;
    
    const cart = await this.config.cartProvider.removeItems(userEmail, items);
    
    return {
      success: true,
      data: cart,
      message: `Removed ${items.length} item(s) from cart`
    };
  }

  private async handleViewCart(userEmail: string): Promise<ToolResult> {
    const cart = await this.config.cartProvider.getCart(userEmail);
    
    return {
      success: true,
      data: cart,
      message: `Cart contains ${cart.totalItems} items`
    };
  }

  private async handlePreviewOrder(userEmail: string): Promise<ToolResult> {
    const cart = await this.config.cartProvider.getCart(userEmail);
    const customerInfo = await this.config.paymentProvider.validateCustomer(userEmail);
    const shippingAddress = await this.config.profileProvider.getShippingAddress(userEmail);
    
    // Calculate order totals with tax and shipping using configurable providers
    const orderTotals = await calculateOrderTotals(cart.items || [], this.config, shippingAddress || undefined);
    
    return {
      success: true,
      data: {
        cart,
        orderTotals,
        customerInfo,
        shippingAddress,
        readyForCheckout: !!(shippingAddress && customerInfo.hasPaymentMethods)
      },
      message: `Order preview ready with ${cart.items?.length || 0} items. Subtotal: $${orderTotals.subtotal}, Shipping: $${orderTotals.shipping}, Tax: $${orderTotals.tax}, Total: $${orderTotals.total}`
    };
  }

  private async handleCompleteCheckout(parameters: Record<string, unknown>, userEmail: string): Promise<ToolResult> {
    // Get cart and validate
    const cart = await this.config.cartProvider.getCart(userEmail);
    if (cart.items.length === 0) {
      return { success: false, error: 'Cart is empty' };
    }
    
    // Get shipping address
    const shippingAddress = await this.config.profileProvider.getShippingAddress(userEmail);
    if (!shippingAddress) {
      return { 
        success: false, 
        error: 'No shipping address found. Please save your shipping address in your profile settings first.' 
      };
    }
    
    // Validate customer payment methods
    const customerInfo = await this.config.paymentProvider.validateCustomer(userEmail);
    if (!customerInfo.hasPaymentMethods) {
      return { 
        success: false, 
        error: 'No payment methods found. Please add a payment method in your profile settings first.' 
      };
    }
    
    // Calculate order totals with tax and shipping
    const orderTotals = await calculateOrderTotals(cart.items || [], this.config, shippingAddress);
    
    // Create secure payment token with calculated totals
    const secureToken = await this.config.paymentProvider.createSecureToken(cart, customerInfo, userEmail, orderTotals);
    
    // Complete payment with calculated totals
    const paymentResult = await this.config.paymentProvider.capturePayment(
      secureToken.token, 
      cart, 
      shippingAddress, 
      userEmail,
      orderTotals
    );
    
    if (paymentResult.success) {
      // Save order to the orders system
      try {
        const orderData = {
          orderId: paymentResult.orderId || `ai_order_${Date.now()}`,
          paymentIntentId: paymentResult.transactionId || '',
          customerInfo: {
            firstName: shippingAddress.firstName,
            lastName: shippingAddress.lastName,
            email: userEmail,
            phone: shippingAddress.phone || ''
          },
          shippingAddress: {
            address: `${shippingAddress.address1}${shippingAddress.address2 ? ', ' + shippingAddress.address2 : ''}`,
            city: shippingAddress.city,
            state: shippingAddress.state,
            zipCode: shippingAddress.zipCode,
            country: shippingAddress.country
          },
          items: cart.items.map(item => ({
            id: item.id,
            productName: item.name,
            quantity: item.quantity,
            price: item.price,
            currency: orderTotals.currency
          })),
          totals: {
            subtotal: orderTotals.subtotal,
            shipping: orderTotals.shipping,
            tax: orderTotals.tax,
            total: orderTotals.total,
            currency: orderTotals.currency
          },
          status: 'confirmed' as const,
          createdAt: new Date().toISOString(),
          userId: userEmail
        };

        // Save order via API call
        console.log('Attempting to save order to:', `${this.baseUrl}/api/save-order`);
        console.log('Order data being sent:', JSON.stringify(orderData, null, 2));
        
        const saveResponse = await fetch(`${this.baseUrl}/api/save-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });

        console.log('Save order response status:', saveResponse.status);
        const responseText = await saveResponse.text();
        console.log('Save order response:', responseText);

        if (!saveResponse.ok) {
          console.error('Failed to save order:', responseText);
        } else {
          console.log('Order saved successfully:', orderData.orderId);
        }
      } catch (saveError) {
        console.error('Error saving order:', saveError);
        // Don't fail the whole checkout if order saving fails
      }

      // Clear cart after successful order
      await this.config.cartProvider.clearCart(userEmail);
      
      return {
        success: true,
        data: paymentResult,
        message: `🎉 Order placed successfully! Order ID: ${paymentResult.orderId}. Total charged: $${orderTotals.total}`
      };
    } else {
      return {
        success: false,
        error: paymentResult.error || 'Payment processing failed'
      };
    }
  }

  // Main chat completion method
  async processChat(messages: ChatMessage[], userEmail: string): Promise<string> {
    if (!this.config.azureOpenAI.endpoint || !this.config.azureOpenAI.apiKey) {
      throw new Error('Azure OpenAI configuration missing');
    }

    // Add system message
    const systemMessage: ChatMessage = {
      role: 'system',
      content: this.getSystemPrompt()
    };

    const chatMessages = [systemMessage, ...messages];

    try {
      const response = await fetch(`${this.config.azureOpenAI.endpoint}/openai/deployments/${this.config.azureOpenAI.deploymentName}/chat/completions?api-version=2024-12-01-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.azureOpenAI.apiKey,
        },
        body: JSON.stringify({
          messages: chatMessages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          tools: this.getTools(),
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

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          const toolResult = await this.executeTool(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments),
            userEmail
          );
          
          // Add tool result to conversation
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }
        
        // Make another call to get the final response
        const finalResponse = await fetch(`${this.config.azureOpenAI.endpoint}/openai/deployments/${this.config.azureOpenAI.deploymentName}/chat/completions?api-version=2024-12-01-preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': this.config.azureOpenAI.apiKey,
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
}