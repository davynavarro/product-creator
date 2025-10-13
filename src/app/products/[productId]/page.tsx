import { readFile } from 'fs/promises';
import { join } from 'path';
import { notFound } from 'next/navigation';
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

interface ProductRecord extends ProductData {
  id: string;
  imageUrl: string;
  createdAt: string;
  slug: string;
}

interface Props {
  params: Promise<{ productId: string }>;
}

async function getProduct(productId: string): Promise<ProductRecord | null> {
  try {
    const filePath = join(process.cwd(), 'data', 'products', `${productId}.json`);
    const fileContent = await readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch {
    return null;
  }
}

export default async function ProductPageRoute({ params }: Props) {
  const { productId } = await params;
  const product = await getProduct(productId);

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
    const indexPath = join(process.cwd(), 'data', 'products', 'index.json');
    const indexContent = await readFile(indexPath, 'utf-8');
    const products: Array<{ id: string }> = JSON.parse(indexContent);
    
    return products.map((product) => ({
      productId: product.id,
    }));
  } catch {
    return [];
  }
}