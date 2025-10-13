# GenAI Product Builder

An AI-powered product page generator that creates professional product websites from a photo and brief description using Azure OpenAI.

## Features

- Upload product images
- Generate comprehensive product details from brief descriptions
- Create professional static product pages
- AI-powered content generation using Azure OpenAI
- Responsive design with Tailwind CSS

## Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Azure OpenAI:**
   - Copy `.env.local.example` to `.env.local`
   - Fill in your Azure OpenAI credentials:
     ```
     AZURE_OPENAI_API_KEY=your_api_key
     AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
     AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
     ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open [http://localhost:3000](http://localhost:3000)** to start creating product pages.

## How it works

1. Upload a product image and provide a brief description
2. The app uses Azure OpenAI to generate detailed product information
3. A professional product page is created with the generated content
4. Each product gets a unique URL for sharing

## Technology Stack

- Next.js 15 with App Router
- TypeScript
- Tailwind CSS
- Azure OpenAI
- React Hook Form
- Lucide React Icons
