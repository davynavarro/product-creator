import { readFile } from 'fs/promises';
import { join } from 'path';
import ProductsList from '@/components/ProductsList';

interface ProductIndexItem {
  id: string;
  productName: string;
  slug: string;
  category: string;
  createdAt: string;
  imageUrl: string;
  pricing: {
    currency: string;
    price: number;
    originalPrice?: number;
    discount?: string;
  };
}

async function getProducts(): Promise<ProductIndexItem[]> {
  try {
    const indexPath = join(process.cwd(), 'data', 'products', 'index.json');
    const indexContent = await readFile(indexPath, 'utf-8');
    return JSON.parse(indexContent);
  } catch {
    return [];
  }
}

export default async function ProductsPage() {
  const products = await getProducts();

  return <ProductsList initialProducts={products} />;
}