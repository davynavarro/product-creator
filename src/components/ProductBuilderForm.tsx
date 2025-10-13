'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Upload, Loader2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface FormData {
  productBrief: string;
  image: FileList;
}

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

interface ProductBuilderFormProps {
  onProductGenerated?: (productData: ProductData, imageUrl: string) => void;
}

export default function ProductBuilderForm({ onProductGenerated }: ProductBuilderFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset
  } = useForm<FormData>();

  const imageFiles = watch('image');
  const imagePreview = imageFiles && imageFiles[0] ? URL.createObjectURL(imageFiles[0]) : null;

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const result = await response.json();
    return result.url;
  };

  const generateProduct = async (productBrief: string, imageName: string) => {
    const response = await fetch('/api/generate-product', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productBrief,
        imageName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Generation failed');
    }

    const result = await response.json();
    return result.productData;
  };

  const saveProduct = async (productData: ProductData, imageUrl: string) => {
    const response = await fetch('/api/save-product', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productData,
        imageUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Save failed');
    }

    const result = await response.json();
    return result;
  };

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      setIsUploading(true);

      // Upload image
      const imageUrl = await uploadImage(data.image[0]);
      setIsUploading(false);

      // Generate product details
      setIsGenerating(true);
      const productData = await generateProduct(data.productBrief, data.image[0].name);
      setIsGenerating(false);

      // Save product and get URL
      setIsSaving(true);
      const saveResult = await saveProduct(productData, imageUrl);
      setIsSaving(false);

      // If parent handler exists (for in-memory view), call it
      if (onProductGenerated) {
        onProductGenerated(productData, imageUrl);
      } else {
        // Otherwise redirect to static product page
        router.push(`/products/${saveResult.productId}`);
      }
      
      // Reset form
      reset();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsUploading(false);
      setIsGenerating(false);
      setIsSaving(false);
    }
  };

  const isProcessing = isUploading || isGenerating || isSaving;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          AI Product Page Builder
        </h1>
        <p className="text-gray-600 mb-4">
          Upload a product image and brief description to generate a professional product page
        </p>
        <Link
          href="/products"
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          View All Generated Products →
        </Link>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Product Image
          </label>
          <div className="border-2 relative border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            {imagePreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-64 mx-auto rounded-lg"
                />
                <div className="mt-2 text-sm text-gray-500">
                  Click to change image
                </div>
              </div>
            ) : (
              <div>
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-2">
                  <span className="text-sm text-gray-600">
                    Click to upload or drag and drop
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  PNG, JPG, GIF up to 10MB
                </div>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              {...register('image', {
                required: 'Please select an image',
                validate: {
                  fileType: (files) => {
                    if (!files || !files[0]) return true;
                    const file = files[0];
                    if (!file.type.startsWith('image/')) {
                      return 'Please select an image file';
                    }
                    return true;
                  },
                  fileSize: (files) => {
                    if (!files || !files[0]) return true;
                    const file = files[0];
                    if (file.size > 10 * 1024 * 1024) {
                      return 'File size must be less than 10MB';
                    }
                    return true;
                  },
                },
              })}
            />
          </div>
          {errors.image && (
            <p className="mt-1 text-sm text-red-600">{errors.image.message}</p>
          )}
        </div>

        {/* Product Brief */}
        <div>
          <label
            htmlFor="productBrief"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Product Brief
          </label>
          <textarea
            id="productBrief"
            rows={4}
            className="block text-black w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Describe your product... (e.g., 'A wireless Bluetooth headphone with noise cancellation, 30-hour battery life, perfect for commuters and music lovers')"
            {...register('productBrief', {
              required: 'Please provide a product brief',
              minLength: {
                value: 20,
                message: 'Please provide a more detailed description (at least 20 characters)',
              },
            })}
          />
          {errors.productBrief && (
            <p className="mt-1 text-sm text-red-600">{errors.productBrief.message}</p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* Progress Indicator */}
        {isProcessing && (
          <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
            {isUploading && (
              <>
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                <span className="text-sm text-blue-700">Uploading image...</span>
              </>
            )}
            {isGenerating && (
              <>
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                <span className="text-sm text-blue-700">Generating product details...</span>
              </>
            )}
            {isSaving && (
              <>
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                <span className="text-sm text-blue-700">Creating product page...</span>
              </>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isProcessing}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? (
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Processing...</span>
            </div>
          ) : (
            'Generate Product Page'
          )}
        </button>
      </form>
    </div>
  );
}