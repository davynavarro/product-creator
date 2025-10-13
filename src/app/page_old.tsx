'use client';

import { useState } from 'react';
import ProductBuilderForm from '@/components/ProductBuilderForm';
import ProductPage from '@/components/ProductPage';

interface ProductData {
  productName: string;
  tagline: string;
  description: string;
  keyFeatures: string[];
  specifications: Record<string, string>;
  pricing: {
    currency: string;
    price: number;
    originalPrice?: number;
    discount?: string;
  };
  benefits: string[];
  targetAudience: string;
  category: string;
  tags: string[];
}

export default function Home() {
  const [currentView, setCurrentView] = useState<'form' | 'product'>('form');
  const [generatedProduct, setGeneratedProduct] = useState<ProductData | null>(null);
  const [productImageUrl, setProductImageUrl] = useState<string>('');

  const handleProductGenerated = (productData: ProductData, imageUrl: string) => {
    setGeneratedProduct(productData);
    setProductImageUrl(imageUrl);
    setCurrentView('product');
  };

  const handleBackToForm = () => {
    setCurrentView('form');
    setGeneratedProduct(null);
    setProductImageUrl('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {currentView === 'form' ? (
        <div className="py-12">
          <ProductBuilderForm onProductGenerated={handleProductGenerated} />
        </div>
      ) : generatedProduct ? (
        <ProductPage
          productData={generatedProduct}
          imageUrl={productImageUrl}
          onBack={handleBackToForm}
        />
      ) : null}
    </div>
  );
}
          </a>
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
