# Project Context

## Purpose
AI-powered product page generator that creates professional e-commerce product websites from a photo and brief description. The application uses Azure OpenAI to transform simple product inputs into comprehensive product details, generating static product pages with unique URLs for sharing.

## Tech Stack
- Next.js 15 (App Router, TypeScript, Turbopack)
- Vercel (hosting and deployment)
- Vercel Blob Store (image and data storage)
- TailwindCSS 4 (styling and responsive design)
- Azure OpenAI (AI content generation)
- React Hook Form (form handling)
- Lucide React (icons)

## Project Conventions

### Code Style
- TypeScript strict mode enabled
- ESLint with Next.js and TypeScript configurations
- Functional components with React hooks
- Client components marked with 'use client' directive
- Server-side API routes for backend functionality
- Absolute imports using `@/*` path mapping

### Architecture Patterns
- Next.js App Router structure with nested layouts
- API routes for backend services (`/api/*`)
- Component-based architecture in `/src/components`
- Utility functions in `/src/lib`
- Separation of concerns: forms, data storage, and AI generation
- Static generation for product pages with dynamic routing

### Testing Strategy
- No specific testing framework configured yet
- Manual testing through development server
- Production builds validated before deployment

### Git Workflow
- Main branch development
- Feature-based commits
- No specific branching strategy documented

## Domain Context
E-commerce product page generation with focus on:
- Product image upload and compression
- AI-generated product descriptions, features, and specifications
- Professional product page layouts
- Responsive design for mobile and desktop
- SEO-friendly product URLs with slugs
- Product categorization and tagging

## Important Constraints
- Image compression to 300KB max for performance
- Azure OpenAI rate limits and costs
- Vercel Blob storage limits
- Static site generation requirements
- Browser compatibility for image processing

## External Dependencies
- **Azure OpenAI**: GPT-4 model for content generation
  - Requires API key, endpoint, and deployment name
  - Used for generating product details from brief descriptions
- **Vercel Blob**: File and data storage
  - Stores uploaded images and product JSON data
  - Manages product index for listing functionality
- **Vercel Platform**: Hosting and deployment
  - Automatic deployments from git
  - Edge functions for API routes
