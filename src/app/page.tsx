'use client';

import ProductBuilderForm from '@/components/ProductBuilderForm';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-12">
        <ProductBuilderForm />
      </div>
    </div>
  );
}