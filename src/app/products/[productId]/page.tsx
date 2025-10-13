import { notFound } from 'next/navigation';
import ProductPage from '@/components/ProductPage';
import { getProductFromBlob, getProductsFromBlob } from '@/lib/blob-storage';

interface Props {
  params: Promise<{ productId: string }>;
}

export default async function ProductPageRoute({ params }: Props) {
  const { productId } = await params;
  const product = await getProductFromBlob(productId);

  if (!product) {
    notFound();
  }

  return (
    <ProductPage
      productData={product}
      imageUrl={product.imageUrl}
      productId={productId}
    />
  );
}

// Generate static params for all existing products
export async function generateStaticParams() {
  try {
    const products = await getProductsFromBlob();
    
    return products.map((product) => ({
      productId: product.id,
    }));
  } catch {
    return [];
  }
}