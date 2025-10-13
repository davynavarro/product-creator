'use client';

import ProductBuilderForm from '@/components/ProductBuilderForm';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Link */}
      <div className="absolute top-4 right-4">
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Admin Panel
        </Link>
      </div>
      
      <div className="py-12">
        <ProductBuilderForm />
      </div>
    </div>
  );
}